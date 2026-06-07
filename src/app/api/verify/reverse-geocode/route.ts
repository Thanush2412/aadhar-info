import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lat = searchParams.get('lat');
  const lng = searchParams.get('lng');

  if (!lat || !lng) {
    return NextResponse.json(
      { success: false, message: 'Latitude and Longitude parameters are required' },
      { status: 400 }
    );
  }

  try {
    const url = `https://api.olamaps.io/places/v1/reverse-geocode?latlng=${lat},${lng}&api_key=6WeiLV2SKwBPgB0Ybkqox2KYDBMGxZmRTEpwPYj2`;
    console.log(`[Proxy Geocode Request] url: ${url}`);
    const res = await fetch(url, {
      headers: {
        'Referer': 'https://example.com',
        'X-Request-Id': Math.random().toString(36).substring(2, 15)
      }
    });

    console.log(`[Proxy Geocode Response] status: ${res.status}`);
    const data = await res.json();
    console.log(`[Proxy Geocode JSON] keys: ${Object.keys(data).join(', ')}, status: ${data.status}`);
    return NextResponse.json(data);
  } catch (error) {
    console.error('Reverse Geocode proxy error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to reverse geocode' },
      { status: 500 }
    );
  }
}
