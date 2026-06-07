import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { imageBase64, mimeType } = await request.json();
    if (!imageBase64) {
      return NextResponse.json({ success: false, error: 'No image data provided' }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY || 'AIzaSyA5WvBycs9TgZ3DRsRPuYPh3nhyHQNzu3s';

    console.log("Sending image to Gemini Flash API for address extraction...");

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: 'Extract the complete postal address from this Aadhaar card image. If there are multiple addresses or language translations, return the one that matches or is closest to the main address in English. Return ONLY the final extracted address as a single line, with no extra text, explanations, or labels.'
              },
              {
                inlineData: {
                  mimeType: mimeType || 'image/jpeg',
                  data: imageBase64
                }
              }
            ]
          }
        ]
      })
    });

    const data = await response.json();
    
    // Check if the response contains candidates
    const candidateText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (candidateText) {
      const extractedAddress = candidateText.trim();
      console.log("Extracted address:", extractedAddress);
      return NextResponse.json({ success: true, address: extractedAddress });
    } else {
      console.error('Gemini API Error Response:', data);
      return NextResponse.json({ success: false, error: 'Failed to extract address. Ensure the image is clear.' }, { status: 500 });
    }
  } catch (error: any) {
    console.error('OCR API Exception:', error);
    return NextResponse.json({ success: false, error: error.message || 'Internal server error' }, { status: 500 });
  }
}
