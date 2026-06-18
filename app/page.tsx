'use client';

import { useState } from 'react';
import {
  discoverMovies,
  discoverTV,
  discoverAnime,
  discoverCartoons,
  discoverByCountry,
  getMovieExternalIds,
  type Movie
} from './lib/tmdb';

export default function Home() {
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [results, setResults] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(false);
  const [mediaType, setMediaType] = useState<'movie' | 'tv' | 'anime' | 'cartoon'>('movie');
  const [error, setError] = useState('');
  const [totalFound, setTotalFound] = useState(0);
  
  // Состояния
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedDecade, setSelectedDecade] = useState<string>('');
  const [selectedCountry, setSelectedCountry] = useState<string>('');
  const [page, setPage] = useState(1);
  const [allMovies, setAllMovies] = useState<Movie[]>([]);
  const [resultsLimit, setResultsLimit] = useState(20);
  const [selectedMovie, setSelectedMovie] = useState<Movie | null>(null);
  
  // Состояние для модального окна
  const [modalMovie, setModalMovie] = useState<Movie | null>(null);
  const [movieDetails, setMovieDetails] = useState<any>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Фильтры
  const [year, setYear] = useState<string>('');
  const [minRating, setMinRating] = useState<number>(5);
  const [sortBy, setSortBy] = useState<'similarity' | 'popularity' | 'rating'>('similarity');

  const genres = [
    { id: 28, name: "Боевик" },
    { id: 12, name: "Приключения" },
    { id: 16, name: "Анимация" },
    { id: 35, name: "Комедия" },
    { id: 80, name: "Криминал" },
    { id: 18, name: "Драма" },
    { id: 14, name: "Фэнтези" },
    { id: 27, name: "Ужасы" },
    { id: 10749, name: "Мелодрама" },
    { id: 878, name: "Фантастика" },
    { id: 53, name: "Триллер" },
    { id: 99, name: "Документальный" },
    { id: 10751, name: "Семейный" },
    { id: 9648, name: "Мистика" },
  ];

  const decades = ['1980', '1990', '2000', '2010', '2020'];
  const countries = [
    { code: 'US', name: 'США' },
    { code: 'GB', name: 'Великобритания' },
    { code: 'FR', name: 'Франция' },
    { code: 'JP', name: 'Япония' },
    { code: 'RU', name: 'Россия' },
    { code: 'KR', name: 'Корея' },
    { code: 'IT', name: 'Италия' },
    { code: 'DE', name: 'Германия' },
  ];

  const toggleGenre = (id: string) => {
    setSelectedGenres(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
    setError('');
  };

  const clearAll = () => {
    setSelectedGenres([]);
    setYear('');
    setMinRating(5);
    setResults([]);
    setError('');
    setTotalFound(0);
    setSearchQuery('');
    setSelectedDecade('');
    setSelectedCountry('');
    setPage(1);
    setAllMovies([]);
    setSelectedMovie(null);
    setModalMovie(null);
  };

  const getMediaTypeName = (type: string) => {
    const names: Record<string, string> = {
      movie: 'фильмов',
      tv: 'сериалов',
      anime: 'аниме',
      cartoon: 'мультфильмов'
    };
    return names[type] || type;
  };

  const getGenreNames = (ids: string[]) => {
    return ids.map(id => genres.find(g => g.id.toString() === id)?.name).filter(Boolean).join(', ');
  };

  // Универсальная функция для запросов с повторными попытками
  const fetchWithRetry = async (url: string, retries: number = 3): Promise<any> => {
    for (let i = 0; i < retries; i++) {
      try {
        const response = await fetch(url, {
          signal: AbortSignal.timeout(10000)
        });
        
        if (!response.ok) {
          if (response.status === 401) {
            throw new Error('Неверный API ключ. Проверьте настройки .env.local');
          }
          if (response.status === 429) {
            throw new Error('Слишком много запросов. Подождите немного.');
          }
          throw new Error(`Ошибка API: ${response.status}`);
        }
        
        return await response.json();
      } catch (error: any) {
        console.log(`Попытка ${i + 1} из ${retries} не удалась:`, error.message);
        if (i === retries - 1) throw error;
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
      }
    }
  };

  // Открытие модального окна с деталями фильма
  const openModal = async (movie: Movie) => {
    setModalMovie(movie);
    setLoadingDetails(true);
    setError('');
    
    try {
      const API_KEY = process.env.NEXT_PUBLIC_TMDB_API_KEY;
      const BASE_URL = 'https://api.themoviedb.org/3';
      
      if (!API_KEY) {
        throw new Error('API ключ не найден. Проверьте .env.local');
      }
      
      const url = `${BASE_URL}/movie/${movie.id}?api_key=${API_KEY}&language=ru-RU&append_to_response=credits,videos,similar`;
      const data = await fetchWithRetry(url);
      
      // Получаем внешние ID
      let externalIds = null;
      try {
        externalIds = await getMovieExternalIds(movie.id);
      } catch (e) {
        console.warn('Не удалось загрузить внешние ID');
      }
      
      setMovieDetails({ ...data, external_ids: externalIds });
    } catch (error: any) {
      console.error('Ошибка загрузки деталей:', error);
      setError(`Не удалось загрузить детали: ${error.message}`);
      setMovieDetails(null);
    } finally {
      setLoadingDetails(false);
    }
  };

  const closeModal = () => {
    setModalMovie(null);
    setMovieDetails(null);
    setError('');
  };

  // Случайные фильмы
  const getRandomMovies = async () => {
    setLoading(true);
    setError('');
    setSelectedMovie(null);
    try {
      const API_KEY = process.env.NEXT_PUBLIC_TMDB_API_KEY;
      const BASE_URL = 'https://api.themoviedb.org/3';
      
      if (!API_KEY) {
        throw new Error('API ключ не найден');
      }
      
      const randomPage = Math.floor(Math.random() * 500) + 1;
      const url = `${BASE_URL}/discover/movie?api_key=${API_KEY}&sort_by=popularity.desc&page=${randomPage}&language=ru-RU&vote_count.gte=10`;
      
      const data = await fetchWithRetry(url);
      const shuffled = data.results?.sort(() => 0.5 - Math.random()) || [];
      const randomMovies = shuffled.slice(0, 20);
      
      setResults(randomMovies);
      setTotalFound(randomMovies.length);
      
      if (randomMovies.length === 0) {
        setError('Не удалось загрузить случайные фильмы. Попробуйте еще раз.');
      }
    } catch (error: any) {
      console.error('Ошибка:', error);
      setError(`Ошибка при загрузке: ${error.message}`);
      setResults([]);
    }
    setLoading(false);
  };

  // Поиск по названию
  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setError('Введите название для поиска');
      return;
    }
    setLoading(true);
    setError('');
    setSelectedMovie(null);
    try {
      const API_KEY = process.env.NEXT_PUBLIC_TMDB_API_KEY;
      const BASE_URL = 'https://api.themoviedb.org/3';
      
      if (!API_KEY) {
        throw new Error('API ключ не найден. Проверьте .env.local');
      }
      
      const url = `${BASE_URL}/search/movie?api_key=${API_KEY}&query=${encodeURIComponent(searchQuery)}&language=ru-RU&page=1`;
      console.log('🔍 Поиск:', url);
      
      const data = await fetchWithRetry(url);
      const results = data.results || [];
      
      setResults(results);
      setTotalFound(results.length);
      if (results.length === 0) {
        setError(`Ничего не найдено по запросу "${searchQuery}"`);
      }
    } catch (error: any) {
      console.error('Ошибка поиска:', error);
      setError(`Ошибка при поиске: ${error.message}. Проверьте подключение к интернету.`);
      setResults([]);
    }
    setLoading(false);
  };

  // Похожие фильмы
  const handleSimilarMovies = async (movie: Movie) => {
    setLoading(true);
    setError('');
    setSelectedMovie(movie);
    
    try {
      const API_KEY = process.env.NEXT_PUBLIC_TMDB_API_KEY;
      const BASE_URL = 'https://api.themoviedb.org/3';
      
      if (!API_KEY) {
        throw new Error('API ключ не найден');
      }
      
      const url = `${BASE_URL}/movie/${movie.id}/similar?api_key=${API_KEY}&language=ru-RU&page=1`;
      const data = await fetchWithRetry(url);
      const similarResults = data.results || [];
      
      setResults(similarResults);
      setTotalFound(similarResults.length);
      if (similarResults.length === 0) {
        setError(`Похожих фильмов для "${movie.title || movie.name}" не найдено`);
      }
    } catch (error: any) {
      console.error('Ошибка:', error);
      setError(`Ошибка при загрузке похожих: ${error.message}`);
    }
    setLoading(false);
  };

  // Загрузка еще
  const loadMore = async () => {
    const newPage = page + 1;
    setPage(newPage);
    setLoading(true);
    setError('');
    
    try {
      let movies: Movie[] = [];
      
      if (selectedCountry) {
        movies = await discoverByCountry(selectedCountry, selectedGenres);
      } else if (mediaType === 'movie') {
        movies = await discoverMovies(selectedGenres);
      } else if (mediaType === 'tv') {
        movies = await discoverTV(selectedGenres);
      } else if (mediaType === 'anime') {
        movies = await discoverAnime(selectedGenres);
      } else if (mediaType === 'cartoon') {
        movies = await discoverCartoons(selectedGenres);
      }
      
      const allNewMovies = [...allMovies, ...movies];
      const uniqueMovies = Array.from(
        new Map(allNewMovies.map(item => [item.id, item])).values()
      );
      
      setAllMovies(uniqueMovies);
      setResults(uniqueMovies.slice(0, resultsLimit * newPage));
      setTotalFound(uniqueMovies.length);
    } catch (error: any) {
      console.error('Ошибка загрузки:', error);
      setError(`Ошибка при загрузке: ${error.message}`);
    }
    
    setLoading(false);
  };

  const findRecommendations = async () => {
    setLoading(true);
    setError('');
    setTotalFound(0);
    setPage(1);
    setSelectedMovie(null);
    
    try {
      let movies: Movie[] = [];

      if (selectedCountry) {
        movies = await discoverByCountry(selectedCountry, selectedGenres);
      } else if (mediaType === 'movie') {
        movies = await discoverMovies(selectedGenres);
      } else if (mediaType === 'tv') {
        movies = await discoverTV(selectedGenres);
      } else if (mediaType === 'anime') {
        movies = await discoverAnime(selectedGenres);
      } else if (mediaType === 'cartoon') {
        movies = await discoverCartoons(selectedGenres);
      }

      console.log(`✅ Всего получено: ${movies.length}`);
      
      if (selectedDecade) {
        const decadeStart = parseInt(selectedDecade);
        const decadeEnd = decadeStart + 9;
        movies = movies.filter(movie => {
          const year = parseInt(movie.release_date?.slice(0, 4) || '0');
          return year >= decadeStart && year <= decadeEnd;
        });
      }
      
      setAllMovies(movies);
      setTotalFound(movies.length);

      let filtered = movies.filter(movie => {
        const rating = movie.vote_average || 0;
        const releaseYear = movie.release_date || movie.first_air_date || '';
        const itemYear = releaseYear ? parseInt(releaseYear.slice(0, 4)) : 0;
        const yearMatch = !year || Math.abs(itemYear - parseInt(year)) <= 3;
        return rating >= minRating && yearMatch;
      });

      console.log(`✅ После фильтрации: ${filtered.length}`);

      if (filtered.length === 0) {
        setResults([]);
        setError(`📊 Нет ${getMediaTypeName(mediaType)} с рейтингом ${minRating}+. 
          Попробуйте снизить требования или выбрать другие жанры.`);
        setLoading(false);
        return;
      }

      // Подсчет очков похожести для каждого фильма
      const scoredMovies = filtered.map(movie => {
        const commonGenres = movie.genre_ids?.filter((id: number) =>
          selectedGenres.includes(id.toString())
        ).length || 0;
        
        let genreScore = 0;
        if (selectedGenres.length > 0) {
          genreScore = (commonGenres / selectedGenres.length) * 100;
        } else {
          genreScore = 50;
        }
        
        const ratingScore = (movie.vote_average / 10) * 30;
        const popularityScore = Math.min((movie.popularity || 0) / 1000 * 20, 20);
        const totalScore = genreScore + ratingScore + popularityScore;
        
        return { 
          ...movie, 
          score: totalScore,
          _genreScore: genreScore,
          _ratingScore: ratingScore,
          _popularityScore: popularityScore
        };
      });

      let sorted = [...scoredMovies].sort((a, b) => {
        if (sortBy === 'similarity') {
          return (b.score || 0) - (a.score || 0);
        } else if (sortBy === 'rating') {
          return (b.vote_average || 0) - (a.vote_average || 0);
        } else if (sortBy === 'popularity') {
          return (b.popularity || 0) - (a.popularity || 0);
        }
        return 0;
      });

      const numberedResults = sorted.map((movie, index) => ({
        ...movie,
        rank: index + 1
      }));

      setResults(numberedResults.slice(0, resultsLimit));

    } catch (e: any) {
      console.error('❌ Ошибка:', e);
      setError(`⚠️ ${e.message || 'Ошибка при поиске. Проверьте подключение к интернету.'}`);
      setResults([]);
    }
    setLoading(false);
  };

  return (
    <main className="min-h-screen bg-zinc-950 text-white p-6 md:p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-5xl font-bold text-center mb-3">🎥 Киноподборщик</h1>
        <p className="text-center text-zinc-400 mb-10 text-xl">Подбор от самого похожего</p>

        {/* Поиск и кнопки */}
        <div className="flex flex-wrap gap-4 mb-6">
          <div className="flex-1 min-w-[200px]">
            <input
              type="text"
              placeholder="🔍 Поиск фильмов..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              className="w-full bg-zinc-900 p-3 rounded-2xl outline-none focus:ring-2 focus:ring-violet-600"
            />
          </div>
          
          <button
            onClick={handleSearch}
            disabled={loading}
            className="bg-violet-600 hover:bg-violet-700 disabled:bg-zinc-700 px-6 py-3 rounded-2xl font-medium transition"
          >
            🔍 Искать
          </button>
          
          <button
            onClick={getRandomMovies}
            disabled={loading}
            className="bg-green-600 hover:bg-green-700 disabled:bg-zinc-700 px-6 py-3 rounded-2xl font-medium transition"
          >
            🎲 Случайный фильм
          </button>
          
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="bg-zinc-800 hover:bg-zinc-700 px-6 py-3 rounded-2xl font-medium"
          >
            ⚙️ Фильтры {showFilters ? '▲' : '▼'}
          </button>
        </div>

        {/* Фильтры */}
        {showFilters && (
          <div className="bg-zinc-900 p-6 rounded-3xl mb-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm mb-2">Десятилетие</label>
              <select
                value={selectedDecade}
                onChange={(e) => setSelectedDecade(e.target.value)}
                className="w-full bg-zinc-800 p-3 rounded-2xl outline-none focus:ring-2 focus:ring-violet-600"
              >
                <option value="">Все</option>
                {decades.map(decade => (
                  <option key={decade} value={decade}>{decade}-е</option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm mb-2">Страна</label>
              <select
                value={selectedCountry}
                onChange={(e) => setSelectedCountry(e.target.value)}
                className="w-full bg-zinc-800 p-3 rounded-2xl outline-none focus:ring-2 focus:ring-violet-600"
              >
                <option value="">Все</option>
                {countries.map(country => (
                  <option key={country.code} value={country.code}>{country.name}</option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm mb-2">Год выпуска</label>
              <input
                type="number"
                placeholder="Например: 2023"
                value={year}
                onChange={(e) => setYear(e.target.value)}
                className="w-full bg-zinc-800 p-3 rounded-2xl outline-none focus:ring-2 focus:ring-violet-600"
              />
            </div>
            
            <div>
              <label className="block text-sm mb-2">Минимальный рейтинг: {minRating}</label>
              <input
                type="range"
                min="1"
                max="10"
                step="0.5"
                value={minRating}
                onChange={(e) => setMinRating(Number(e.target.value))}
                className="w-full accent-violet-600"
              />
              <div className="text-center text-sm text-zinc-400">{minRating}</div>
            </div>
            
            <div>
              <label className="block text-sm mb-2">Сортировать по</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="w-full bg-zinc-800 p-3 rounded-2xl outline-none focus:ring-2 focus:ring-violet-600"
              >
                <option value="similarity">Похожести</option>
                <option value="rating">Рейтингу</option>
                <option value="popularity">Популярности</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm mb-2">Количество результатов</label>
              <select
                value={resultsLimit}
                onChange={(e) => setResultsLimit(Number(e.target.value))}
                className="w-full bg-zinc-800 p-3 rounded-2xl outline-none focus:ring-2 focus:ring-violet-600"
              >
                <option value="20">20</option>
                <option value="50">50</option>
                <option value="100">100</option>
              </select>
            </div>
          </div>
        )}

        {/* Типы контента */}
        <div className="flex justify-center mb-10 gap-3 flex-wrap">
          {[
            { id: 'movie', label: 'Фильмы' },
            { id: 'tv', label: 'Сериалы' },
            { id: 'anime', label: 'Аниме' },
            { id: 'cartoon', label: 'Мультфильмы' }
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => { 
                setMediaType(t.id as any); 
                setResults([]);
                setError('');
                setSelectedCountry('');
                setSelectedMovie(null);
              }}
              className={`px-6 py-3 rounded-2xl font-medium transition ${
                mediaType === t.id ? 'bg-violet-600' : 'bg-zinc-900 hover:bg-zinc-800'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Жанры */}
        <div className="mb-10">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-semibold">Выбери жанры:</h2>
            <div>
              <span className="text-zinc-400 text-sm mr-4">
                Выбрано: {selectedGenres.length}
              </span>
              <button onClick={clearAll} className="text-red-400 hover:text-red-500 text-sm underline">
                Очистить всё
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {genres.map((g) => (
              <button
                key={g.id}
                onClick={() => toggleGenre(g.id.toString())}
                className={`p-4 rounded-2xl text-left transition-all font-medium ${
                  selectedGenres.includes(g.id.toString()) 
                    ? 'bg-violet-600 text-white ring-2 ring-violet-400' 
                    : 'bg-zinc-900 hover:bg-zinc-800 border border-zinc-700'
                }`}
              >
                {g.name}
              </button>
            ))}
          </div>
          {selectedGenres.length === 0 && (
            <p className="text-zinc-500 text-sm mt-3 text-center">
              ⚡ Если не выбрать жанры, будут показаны самые популярные {getMediaTypeName(mediaType)}
            </p>
          )}
          {selectedGenres.length > 0 && (
            <p className="text-zinc-400 text-sm mt-3 text-center">
              🎯 Выбраны: {getGenreNames(selectedGenres)}
            </p>
          )}
        </div>

        <div className="text-center mb-12">
          <button
            onClick={findRecommendations}
            disabled={loading}
            className="bg-violet-600 hover:bg-violet-700 disabled:bg-zinc-700 px-12 py-4 rounded-2xl text-xl font-semibold transition"
          >
            {loading ? "🔄 Ищем рекомендации..." : "🔍 Найти рекомендации"}
          </button>
        </div>

        {totalFound > 0 && !loading && (
          <div className="text-center text-zinc-400 mb-4">
            Найдено {totalFound} {getMediaTypeName(mediaType)}
            {selectedGenres.length > 0 && ` по жанрам: ${getGenreNames(selectedGenres)}`}
            {selectedCountry && ` из страны: ${countries.find(c => c.code === selectedCountry)?.name}`}
            {selectedDecade && ` (${selectedDecade}-е)`}
          </div>
        )}

        {/* Отображение ошибок */}
        {error && (
          <div className="bg-red-900/50 border border-red-500 text-red-200 p-6 rounded-3xl mb-8 text-center">
            <p className="font-semibold">⚠️ {error}</p>
            {error.includes('интернет') && (
              <p className="text-sm text-red-300/70 mt-2">
                💡 Проверьте подключение к интернету и попробуйте снова
              </p>
            )}
            {error.includes('API ключ') && (
              <p className="text-sm text-red-300/70 mt-2">
                💡 Проверьте файл .env.local и перезапустите сервер
              </p>
            )}
          </div>
        )}

        {/* Карточка выбранного фильма */}
        {selectedMovie && (
          <div className="mb-8 bg-gradient-to-r from-violet-900/30 to-zinc-900 border border-violet-500/30 rounded-3xl p-6">
            <div className="flex items-center gap-6">
              <div className="flex-shrink-0">
                {selectedMovie.poster_path ? (
                  <img
                    src={`https://image.tmdb.org/t/p/w200${selectedMovie.poster_path}`}
                    alt={selectedMovie.title || selectedMovie.name}
                    className="w-32 h-48 object-cover rounded-2xl"
                  />
                ) : (
                  <div className="w-32 h-48 bg-zinc-800 rounded-2xl flex items-center justify-center text-4xl">🎬</div>
                )}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="text-2xl font-bold">{selectedMovie.title || selectedMovie.name}</h3>
                  <span className="bg-violet-600 px-3 py-1 rounded-full text-sm">⭐ {selectedMovie.vote_average?.toFixed(1) || '?'}</span>
                </div>
                <p className="text-zinc-400 mb-3 line-clamp-2">{selectedMovie.overview || "Нет описания"}</p>
                <div className="flex gap-2 flex-wrap">
                  {selectedMovie.genre_ids?.map((id) => {
                    const genre = genres.find(g => g.id === id);
                    return genre ? (
                      <span key={id} className="bg-zinc-800 px-3 py-1 rounded-full text-xs">
                        {genre.name}
                      </span>
                    ) : null;
                  })}
                </div>
                <p className="text-sm text-zinc-500 mt-2">
                  📅 {selectedMovie.release_date || selectedMovie.first_air_date || 'Дата неизвестна'}
                </p>
                <p className="text-xs text-violet-400 mt-2">🔍 Похожие фильмы:</p>
              </div>
              <button
                onClick={() => setSelectedMovie(null)}
                className="text-zinc-500 hover:text-white text-sm self-start"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {/* Результаты с нумерацией */}
        {results.length > 0 && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-3xl font-bold">
                {selectedMovie ? `Похожие на "${selectedMovie.title || selectedMovie.name}"` : `Рекомендации для тебя`} 
                ({results.length})
              </h2>
              <div className="text-sm text-zinc-400 bg-zinc-900 px-4 py-2 rounded-full">
                {sortBy === 'similarity' && '🔢 По порядку похожести'}
                {sortBy === 'rating' && '⭐ По рейтингу'}
                {sortBy === 'popularity' && '🔥 По популярности'}
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
              {results.map((movie, index) => (
                <div 
                  key={movie.id} 
                  className="bg-zinc-900 rounded-3xl overflow-hidden hover:scale-[1.03] transition-transform group cursor-pointer relative"
                  onClick={() => openModal(movie)}
                >
                  {/* Номер рейтинга */}
                  <div className="absolute top-2 left-2 z-10">
                    <div className="bg-violet-600 text-white w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shadow-lg">
                      {movie.rank || index + 1}
                    </div>
                  </div>
                  
                  {/* Значок "Лучший выбор" для первого места */}
                  {index === 0 && (
                    <div className="absolute top-2 right-2 z-10">
                      <div className="bg-yellow-500 text-black text-xs px-2 py-1 rounded-full font-bold shadow-lg animate-pulse">
                        🏆 Лучший
                      </div>
                    </div>
                  )}
                  
                  {movie.poster_path ? (
                    <img
                      src={`https://image.tmdb.org/t/p/w500${movie.poster_path}`}
                      alt={movie.title || movie.name}
                      className="w-full h-80 object-cover"
                    />
                  ) : (
                    <div className="w-full h-80 bg-zinc-800 flex items-center justify-center text-6xl">🎬</div>
                  )}
                  <div className="p-4">
                    <div className="flex justify-between items-start gap-2">
                      <h3 className="font-bold text-lg line-clamp-2 flex-1">
                        {movie.rank}. {movie.title || movie.name}
                      </h3>
                    </div>
                    <div className="flex justify-between items-center mt-2">
                      <p className="text-violet-400 font-semibold">⭐ {movie.vote_average?.toFixed(1) || '?'}</p>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSimilarMovies(movie);
                        }}
                        className="text-xs bg-zinc-800 hover:bg-zinc-700 px-3 py-1 rounded-full transition"
                      >
                        🔄 Похожие
                      </button>
                    </div>
                    <p className="text-zinc-400 text-sm line-clamp-3 mt-3">
                      {movie.overview || "Нет описания"}
                    </p>
                    <p className="text-xs text-zinc-500 mt-2">
                      👆 Нажмите для деталей
                    </p>
                  </div>
                </div>
              ))}
            </div>
            
            {/* Кнопка "Загрузить еще" */}
            {results.length < totalFound && (
              <div className="text-center mt-8">
                <button
                  onClick={loadMore}
                  disabled={loading}
                  className="bg-zinc-800 hover:bg-zinc-700 disabled:bg-zinc-900 px-8 py-3 rounded-2xl font-medium transition"
                >
                  {loading ? '🔄 Загрузка...' : `📥 Загрузить еще (${results.length}/${totalFound})`}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Модальное окно */}
        {modalMovie && (
          <div 
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={closeModal}
          >
            <div 
              className="bg-zinc-900 rounded-3xl max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6 relative"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Кнопка закрытия */}
              <button
                onClick={closeModal}
                className="absolute top-4 right-4 text-zinc-500 hover:text-white text-2xl z-10"
              >
                ✕
              </button>

              {loadingDetails ? (
                <div className="flex items-center justify-center h-64">
                  <div className="text-center">
                    <div className="text-4xl mb-4">🔄</div>
                    <p className="text-zinc-400">Загрузка деталей...</p>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex flex-col md:flex-row gap-6">
                    {/* Постер */}
                    <div className="flex-shrink-0">
                      {modalMovie.poster_path ? (
                        <img
                          src={`https://image.tmdb.org/t/p/w500${modalMovie.poster_path}`}
                          alt={modalMovie.title || modalMovie.name}
                          className="w-full md:w-64 rounded-2xl object-cover"
                        />
                      ) : (
                        <div className="w-full md:w-64 h-96 bg-zinc-800 rounded-2xl flex items-center justify-center text-6xl">🎬</div>
                      )}
                    </div>

                    {/* Информация */}
                    <div className="flex-1">
                      <h2 className="text-3xl font-bold mb-2">
                        {modalMovie.title || modalMovie.name}
                      </h2>
                      
                      {modalMovie.release_date && (
                        <p className="text-zinc-400 mb-2">
                          📅 {new Date(modalMovie.release_date).getFullYear()}
                        </p>
                      )}
                      
                      <div className="flex items-center gap-4 mb-4">
                        <span className="bg-violet-600 px-3 py-1 rounded-full text-sm">
                          ⭐ {modalMovie.vote_average?.toFixed(1) || '?'}/10
                        </span>
                        {modalMovie.vote_count && (
                          <span className="text-zinc-400 text-sm">
                            {modalMovie.vote_count} оценок
                          </span>
                        )}
                      </div>

                      {/* Жанры */}
                      <div className="flex gap-2 flex-wrap mb-4">
                        {modalMovie.genre_ids?.map((id) => {
                          const genre = genres.find(g => g.id === id);
                          return genre ? (
                            <span key={id} className="bg-zinc-800 px-3 py-1 rounded-full text-xs">
                              {genre.name}
                            </span>
                          ) : null;
                        })}
                      </div>

                      {/* Описание */}
                      <div className="mb-4">
                        <h3 className="text-lg font-semibold mb-2">О фильме</h3>
                        <p className="text-zinc-300 leading-relaxed">
                          {movieDetails?.overview || modalMovie.overview || "Описание отсутствует"}
                        </p>
                      </div>

                      {/* Дополнительная информация из деталей */}
                      {movieDetails && (
                        <div className="grid grid-cols-2 gap-2 mb-4 text-sm">
                          {movieDetails.runtime && (
                            <p className="text-zinc-400">⏱️ {movieDetails.runtime} мин.</p>
                          )}
                          {movieDetails.status && (
                            <p className="text-zinc-400">📌 {movieDetails.status}</p>
                          )}
                          {movieDetails.budget && movieDetails.budget > 0 && (
                            <p className="text-zinc-400">💰 Бюджет: ${movieDetails.budget.toLocaleString()}</p>
                          )}
                          {movieDetails.revenue && movieDetails.revenue > 0 && (
                            <p className="text-zinc-400">💵 Сборы: ${movieDetails.revenue.toLocaleString()}</p>
                          )}
                          {movieDetails.external_ids?.imdb_id && (
                            <p className="text-zinc-400">🎬 IMDb ID: {movieDetails.external_ids.imdb_id}</p>
                          )}
                        </div>
                      )}

                      {/* Ссылки на платформы */}
                      <div className="mt-6">
                        <h3 className="text-lg font-semibold mb-3">Где посмотреть</h3>
                        <div className="flex flex-wrap gap-3">
                          {/* Кинопоиск */}
                          <a
                            href={`https://www.kinopoisk.ru/index.php?kp_query=${encodeURIComponent(
                              (modalMovie.title || modalMovie.name || '') + 
                              (modalMovie.release_date ? ' ' + new Date(modalMovie.release_date).getFullYear() : '')
                            )}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="bg-orange-600 hover:bg-orange-700 px-4 py-2 rounded-xl transition flex items-center gap-2"
                          >
                            🎬 Кинопоиск
                          </a>
                          
                          {/* IMDb */}
                          <a
                            href={`https://www.imdb.com/find?q=${encodeURIComponent(modalMovie.title || modalMovie.name || '')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="bg-yellow-600 hover:bg-yellow-700 px-4 py-2 rounded-xl transition flex items-center gap-2"
                          >
                            ⭐ IMDb
                          </a>
                          
                          {/* Трейлер */}
                          <a
                            href={`https://www.youtube.com/results?search_query=${encodeURIComponent(modalMovie.title || modalMovie.name || '')}+трейлер`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded-xl transition flex items-center gap-2"
                          >
                            ▶️ Трейлер
                          </a>

                          {/* Google */}
                          <a
                            href={`https://www.google.com/search?q=${encodeURIComponent(modalMovie.title || modalMovie.name || '')}+фильм`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-xl transition flex items-center gap-2"
                          >
                            🔍 Google
                          </a>
                          
                          {/* Rotten Tomatoes */}
                          <a
                            href={`https://www.rottentomatoes.com/search?search=${encodeURIComponent(modalMovie.title || modalMovie.name || '')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="bg-red-800 hover:bg-red-900 px-4 py-2 rounded-xl transition flex items-center gap-2"
                          >
                            🍅 Rotten Tomatoes
                          </a>
                        </div>
                        
                        <p className="text-xs text-zinc-500 mt-3">
                          💡 Нажмите на ссылку, чтобы открыть страницу фильма
                        </p>
                      </div>

                      {/* Кнопка "Похожие" в модалке */}
                      <button
                        onClick={() => {
                          handleSimilarMovies(modalMovie);
                          closeModal();
                        }}
                        className="mt-4 bg-violet-600 hover:bg-violet-700 px-4 py-2 rounded-xl transition flex items-center gap-2"
                      >
                        🔄 Найти похожие
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}