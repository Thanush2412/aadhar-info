import { NextResponse } from 'next/server';
import { getRecords, updateRecord, generateDemographics } from '@/lib/db';
import { checkTwilioVerification } from '@/lib/sms';

export async function POST(request: Request) {
  try {
    const { id, otp } = await request.json();

    if (!id || !otp) {
      return NextResponse.json(
        { success: false, message: 'Transaction ID and OTP are required' },
        { status: 400 }
      );
    }

    // Find the record
    const records = getRecords();
    const record = records.find(r => r.id === id);

    if (!record) {
      return NextResponse.json(
        { success: false, message: 'Verification session expired or invalid' },
        { status: 404 }
      );
    }

    if (record.status !== 'PENDING') {
      return NextResponse.json(
        { success: false, message: 'This transaction is already processed' },
        { status: 400 }
      );
    }

    // Check OTP via Twilio Verify
    const verifyResult = await checkTwilioVerification(record.phoneNumber, otp);
    if (!verifyResult.success) {
      return NextResponse.json(
        { success: false, message: verifyResult.error || 'Invalid OTP. Verification failed.' },
        { status: 400 }
      );
    }

    // Generate demographic credit card details
    const demographics = generateDemographics(
      record.aadhaarNumber,
      record.existingLocation,
      record.customName,
      record.customDob,
      record.customGender,
      record.customAddress,
      record.panNumber
    );

    // Get IP and User Agent if available (headers)
    const ipAddress = request.headers.get('x-forwarded-for') || '127.0.0.1';
    const userAgent = request.headers.get('user-agent') || 'Unknown Browser';

    // Helper to normalize addresses (alphanumeric only)
    const normalizeAddress = (addr: string): string => {
      return (addr || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    };

    const normAadhaar = normalizeAddress(record.aadhaarDocAddress || '');
    const normPan = normalizeAddress(record.panDocAddress || '');

    // 1. Verify Parity: Aadhaar Address vs PAN Address
    if (!normAadhaar || !normPan || normAadhaar !== normPan) {
      updateRecord(id, {
        status: 'FAILED',
        locationMatchStatus: 'MISMATCHED',
        ipAddress,
        userAgent,
        timestamp: new Date().toISOString()
      });
      return NextResponse.json(
        { success: false, message: 'Document Address Mismatch: The Aadhaar and PAN addresses are not identical.' },
        { status: 400 }
      );
    }

    // 2. Verify GPS Geolocation Alignment
    let gpsCity = '';
    try {
      const parsed = JSON.parse(record.existingLocation || '');
      gpsCity = parsed.city || '';
    } catch {
      gpsCity = record.existingLocation || '';
    }

    const gpsCityLower = gpsCity.toLowerCase().trim();
    
    let gpsMatch = true;
    if (gpsCityLower && gpsCityLower !== 'unknown' && gpsCityLower !== '') {
      const docLower = (record.aadhaarDocAddress || '').toLowerCase();
      const customLower = (record.customAddress || '').toLowerCase();
      
      const docGpsMatch = docLower.includes(gpsCityLower) ||
                          (gpsCityLower === 'delhi' && docLower.includes('new delhi')) ||
                          (gpsCityLower === 'new delhi' && docLower.includes('delhi'));
                          
      const customGpsMatch = customLower.includes(gpsCityLower) ||
                            (gpsCityLower === 'delhi' && customLower.includes('new delhi')) ||
                            (gpsCityLower === 'new delhi' && customLower.includes('delhi'));
                            
      gpsMatch = docGpsMatch && customGpsMatch;
    }

    const locationMatchStatus = gpsMatch ? 'MATCHED' : 'MISMATCHED';

    if (!gpsMatch) {
      updateRecord(id, {
        status: 'FAILED',
        locationMatchStatus,
        ipAddress,
        userAgent,
        timestamp: new Date().toISOString()
      });
      
      return NextResponse.json(
        { 
          success: false, 
          message: `Location Mismatch Alert: The residential address does not align with your physical location (${gpsCity || 'Unknown'}).` 
        },
        { status: 400 }
      );
    }

    // Update the record with VERIFIED status and MATCHED location
    const updated = updateRecord(id, {
      status: 'VERIFIED',
      demographics,
      ipAddress,
      userAgent,
      locationMatchStatus,
      timestamp: new Date().toISOString()
    });

    return NextResponse.json({
      success: true,
      message: 'Aadhaar verified successfully',
      demographics: updated?.demographics
    });

  } catch (error) {
    console.error('Error in confirm-otp API:', error);
    return NextResponse.json(
      { success: false, message: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
