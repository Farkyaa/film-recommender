
const API_KEY = process.env.NEXT_PUBLIC_TMDB_API_KEY;
const BASE_URL = 'https://api.themoviedb.org/3';

export interface Movie {
  id: number;
  title?: string;
  name?: string;
  overview: string;
  poster_path: string | null;
  vote_average: number;
  release_date?: string;
  first_air_date?: string;
  genre_ids: number[];
  popularity?: number;
  vote_count?: number;
  score?: number;
  rank?: number; // Добавляем поле rank как опциональное
  _genreScore?: number;
  _ratingScore?: number;
  _popularityScore?: number;
}

async function fetchFromTMDB(url: string) {
  try {
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Ошибка API: ${response.status}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error: any) {
    console.error('Ошибка запроса к TMDb:', error.message);
    throw error;
  }
}


async function getResultsWithGuarantee(
  baseUrl: string, 
  genreIds: string[], 
  type: string
): Promise<Movie[]> {
  let allResults: Movie[] = [];
  
  let url = baseUrl;
  if (genreIds.length > 0) {
    if (url.includes('with_genres=')) {
      const existingGenres = url.match(/with_genres=([^&]*)/);
      if (existingGenres) {
        const currentGenres = existingGenres[1].split(',');
        const allGenres = [...currentGenres, ...genreIds];
        const uniqueGenres = Array.from(new Set(allGenres));
        url = url.replace(/with_genres=[^&]*/, `with_genres=${uniqueGenres.join(',')}`);
      }
    } else {
      url += `&with_genres=${genreIds.join(',')}`;
    }
  }
  
  console.log(`🔍 ${type} URL:`, url);
  
  try {
    for (let page = 1; page <= 3; page++) {
      const pageUrl = `${url}&page=${page}`;
      const data = await fetchFromTMDB(pageUrl);
      if (data.results && data.results.length > 0) {
        allResults.push(...data.results);
      } else {
        break;
      }
    }
  } catch (error) {
    console.error(`Ошибка при загрузке ${type}:`, error);
  }
  
  allResults = Array.from(
    new Map(allResults.map(item => [item.id, item])).values()
  );
  
  console.log(`📊 Найдено ${allResults.length} уникальных ${type}`);
  
  if (allResults.length < 10) {
    console.log(`🔄 Мало результатов, добавляем популярные ${type}...`);
    const fallbackUrl = baseUrl.replace(/&with_genres=[^&]*/, '');
    try {
      const data = await fetchFromTMDB(fallbackUrl);
      if (data.results) {
        const fallbackResults = data.results.filter((item: Movie) => 
          !allResults.some(existing => existing.id === item.id)
        );
        allResults = [...allResults, ...fallbackResults.slice(0, 20)];
        console.log(`📊 Добавлено ${fallbackResults.length} популярных ${type}`);
      }
    } catch (error) {
      console.error('Ошибка при загрузке популярных:', error);
    }
  }
  
  const filtered = allResults.filter(item => (item.vote_count || 0) >= 5);
  console.log(`✅ Итоговый результат: ${filtered.length} ${type}`);
  
  return filtered;
}


export async function getMovieExternalIds(movieId: number) {
  try {
    const url = `${BASE_URL}/movie/${movieId}/external_ids?api_key=${API_KEY}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Ошибка: ${response.status}`);
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Ошибка получения внешних ID:', error);
    return null;
  }
}
// Поиск по странам
export async function discoverByCountry(countryCode: string, genreIds: string[] = []) {
  const baseUrl = `${BASE_URL}/discover/movie?api_key=${API_KEY}&with_origin_country=${countryCode}&sort_by=popularity.desc&language=ru-RU`;
  return await getResultsWithGuarantee(baseUrl, genreIds, `фильмов из ${countryCode}`);
}

export async function discoverMovies(genreIds: string[] = []) {
  const baseUrl = `${BASE_URL}/discover/movie?api_key=${API_KEY}&sort_by=popularity.desc&language=ru-RU`;
  return await getResultsWithGuarantee(baseUrl, genreIds, 'фильмов');
}

export async function discoverTV(genreIds: string[] = []) {
  const baseUrl = `${BASE_URL}/discover/tv?api_key=${API_KEY}&sort_by=popularity.desc&language=ru-RU`;
  return await getResultsWithGuarantee(baseUrl, genreIds, 'сериалов');
}

export async function discoverAnime(genreIds: string[] = []) {
  const baseUrl = `${BASE_URL}/discover/tv?api_key=${API_KEY}&with_genres=16&with_original_language=ja&sort_by=popularity.desc&language=ru-RU`;
  const otherGenres = genreIds.filter(id => id !== '16');
  console.log('🔍 Запрос аниме с жанрами:', otherGenres);
  return await getResultsWithGuarantee(baseUrl, otherGenres, 'аниме');
}

export async function discoverCartoons(genreIds: string[] = []) {
  const baseUrl = `${BASE_URL}/discover/movie?api_key=${API_KEY}&with_genres=16&sort_by=popularity.desc&language=ru-RU`;
  const otherGenres = genreIds.filter(id => id !== '16' && id !== '10751');
  console.log('🔍 Запрос мультфильмов с жанрами:', otherGenres);
  return await getResultsWithGuarantee(baseUrl, otherGenres, 'мультфильмов');
}