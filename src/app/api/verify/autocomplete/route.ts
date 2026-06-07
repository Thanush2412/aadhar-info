import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const input = searchParams.get('input');

  if (!input) {
    return NextResponse.json(
      { success: false, message: 'Input parameter is required' },
      { status: 400 }
    );
  }

  try {
    const url = `https://api.olamaps.io/places/v1/autocomplete?input=${encodeURIComponent(input)}&api_key=6WeiLV2SKwBPgB0Ybkqox2KYDBMGxZmRTEpwPYj2`;
    const res = await fetch(url, {
      headers: {
        'Referer': 'https://example.com',
        'X-Request-Id': Math.random().toString(36).substring(2, 15)
      }
    });

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Autocomplete proxy error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to fetch suggestions' },
      { status: 500 }
    );
  }
}
