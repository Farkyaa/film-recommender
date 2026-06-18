
import { NextResponse } from 'next/server';

export async function GET() {
  const API_KEY = process.env.NEXT_PUBLIC_TMDB_API_KEY;
  const BASE_URL = 'https://api.themoviedb.org/3';
  
  try {

    const randomPage = Math.floor(Math.random() * 500) + 1;
    
    const url = `${BASE_URL}/discover/movie?api_key=${API_KEY}&sort_by=popularity.desc&page=${randomPage}&language=ru-RU&vote_count.gte=10`;
    
    console.log('🎲 Запрос случайных фильмов:', url);
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Ошибка API: ${response.status}`);
    }
    
    const data = await response.json();
    

    const shuffled = data.results?.sort(() => 0.5 - Math.random()) || [];
    
    return NextResponse.json(shuffled.slice(0, 20));
  } catch (error) {
    console.error('Ошибка в random-movies:', error);
    return NextResponse.json(
      { error: 'Ошибка при загрузке случайных фильмов' },
      { status: 500 }
    );
  }
}