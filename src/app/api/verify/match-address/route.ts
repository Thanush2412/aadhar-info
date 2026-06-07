import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { typedAddress, aadhaarDocAddress } = await request.json();

    if (!typedAddress || !aadhaarDocAddress) {
      return NextResponse.json(
        { success: false, error: 'Both typedAddress and aadhaarDocAddress are required.' },
        { status: 400 }
      );
    }

    const apiKey = process.env.GEMINI_API_KEY || 'AIzaSyA5WvBycs9TgZ3DRsRPuYPh3nhyHQNzu3s';

    console.log("Calling Gemini API to match residential address against Aadhaar address...");

    const promptText = `
Compare the following two Indian addresses:
Address A (extracted from Aadhaar Card): "${aadhaarDocAddress}"
Address B (manually entered by citizen): "${typedAddress}"

Analyze if both represent the same residential location / plot / household. 
Rules:
1. Address details in India can be formatted differently. Minor spelling variations, house number details, area names, and city name variations (e.g. "Bengaluru" vs "Bangalore", "Kolkata" vs "Calcutta") should be accepted.
2. Abbreviations (e.g. "St" vs "Street", "Rd" vs "Road", "Apt" vs "Apartment", "Flr" vs "Floor", "H.No" vs "House No") should be resolved as identical.
3. English translations of Tamil elements (e.g. "Kovai" vs "Coimbatore") should be resolved as identical.
4. If they refer to the same location, set match to true. If they are in completely different streets, areas, cities, states, or are otherwise totally different addresses, set match to false.

Return a JSON object containing keys:
- "match": boolean (true if they match, false if they do not match)
- "reason": string (a short, clear explanation of the comparison result, highlighting any differences if match is false)

Return ONLY valid JSON. Do not include any markdown format blocks or other text.
`;

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
                text: promptText
              }
            ]
          }
        ],
        generationConfig: {
          responseMimeType: 'application/json'
        }
      })
    });

    const data = await response.json();
    
    // Parse response content
    const candidateText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (candidateText) {
      try {
        const result = JSON.parse(candidateText.trim());
        console.log("Address match result:", result);
        return NextResponse.json({
          success: true,
          match: result.match,
          reason: result.reason
        });
      } catch (parseError) {
        console.error('Failed to parse Gemini JSON output:', candidateText);
        // Fallback matching logic in case of JSON parse failure
        const docLower = aadhaarDocAddress.toLowerCase();
        const typedLower = typedAddress.toLowerCase();
        
        // Simple fallback check
        const match = docLower.includes(typedLower) || typedLower.includes(docLower);
        return NextResponse.json({
          success: true,
          match: match,
          reason: 'Fallback keyword matching (JSON parse error)'
        });
      }
    } else {
      console.error('Gemini API Error Response:', data);
      return NextResponse.json({ success: false, error: 'Failed to verify address alignment with AI.' }, { status: 500 });
    }
  } catch (error: any) {
    console.error('Match Address API Exception:', error);
    return NextResponse.json({ success: false, error: error.message || 'Internal server error' }, { status: 500 });
  }
}
