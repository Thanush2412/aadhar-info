import { NextResponse } from 'next/server';
import { addRecord } from '@/lib/db';
import { isValidAadhaar } from '@/lib/verhoeff';
import { sendTwilioVerification } from '@/lib/sms';

export async function POST(request: Request) {
  try {
    const { 
      aadhaarNumber, 
      phoneNumber,
      customName,
      customNameHindi,
      customFatherName,
      customFatherNameHindi,
      customDob,
      customGender,
      customAddress,
      panNumber,
      email,
      existingLocation,
      aadhaarDocName,
      aadhaarDocSize,
      panDocName,
      panDocSize,
      aadhaarDocAddress,
      panDocAddress
    } = await request.json();

    // Clean inputs
    const cleanAadhaar = (aadhaarNumber || '').replace(/\s+/g, '');
    const cleanPhone = (phoneNumber || '').replace(/\s+/g, '');

    // Validate Aadhaar
    if (!isValidAadhaar(cleanAadhaar)) {
      return NextResponse.json(
        { success: false, message: 'Invalid Aadhaar Number. Please verify and try again.' },
        { status: 400 }
      );
    }

    // Validate Phone Number
    if (!/^[6-9]\d{9}$/.test(cleanPhone)) {
      return NextResponse.json(
        { success: false, message: 'Invalid Mobile Number. Must be a 10-digit Indian mobile number.' },
        { status: 400 }
      );
    }

    // Validate PAN if provided
    if (panNumber && !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(panNumber.toUpperCase())) {
      return NextResponse.json(
        { success: false, message: 'Invalid PAN Number format.' },
        { status: 400 }
      );
    }

    // Helper to normalize addresses (alphanumeric only)
    const normalizeAddress = (addr: string): string => {
      return (addr || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    };

    const normAadhaar = normalizeAddress(aadhaarDocAddress);
    const normPan = normalizeAddress(panDocAddress);

    // 1. Check Parity: Aadhaar Address vs PAN Address
    if (!normAadhaar || !normPan || normAadhaar !== normPan) {
      return NextResponse.json(
        { 
          success: false, 
          message: 'Document Address Mismatch: The address extracted from your Aadhaar Card scan does not match your PAN registry address.' 
        },
        { status: 400 }
      );
    }

    // 2. Check GPS Geolocation Alignment
    let gpsCity = '';
    try {
      const parsed = JSON.parse(existingLocation || '');
      gpsCity = parsed.city || '';
    } catch {
      gpsCity = existingLocation || '';
    }

    const gpsCityLower = gpsCity.toLowerCase().trim();
    
    let gpsMatch = true;
    if (gpsCityLower && gpsCityLower !== 'unknown' && gpsCityLower !== '') {
      const docLower = (aadhaarDocAddress || '').toLowerCase();
      gpsMatch = docLower.includes(gpsCityLower) ||
                 (gpsCityLower === 'delhi' && docLower.includes('new delhi')) ||
                 (gpsCityLower === 'new delhi' && docLower.includes('delhi'));
    }

    if (!gpsMatch) {
      return NextResponse.json(
        { 
          success: false, 
          message: `Location Security Alert: The document addresses do not match your current physical GPS location (${gpsCity || 'Unknown'}). Verification rejected.` 
        },
        { status: 400 }
      );
    }

    const id = Math.random().toString(36).substring(2, 11);

    // Call Twilio Verify
    const smsResult = await sendTwilioVerification(cleanPhone);

    if (!smsResult.success) {
      return NextResponse.json(
        { success: false, message: smsResult.error || 'Failed to dispatch verification code.' },
        { status: 400 }
      );
    }

    // Save pending verification record in database
    const record = {
      id,
      aadhaarNumber: cleanAadhaar,
      phoneNumber: cleanPhone,
      status: 'PENDING' as const,
      otp: 'TWILIO_VERIFY', // Managed by Twilio Verify
      timestamp: new Date().toISOString(),
      
      // Save user inputs
      customName,
      customNameHindi,
      customFatherName,
      customFatherNameHindi,
      customDob,
      customGender,
      customAddress,
      
      // Credit card details
      panNumber: panNumber ? panNumber.toUpperCase() : undefined,
      email,
      existingLocation,

      // File upload info
      aadhaarDocName,
      aadhaarDocSize,
      panDocName,
      panDocSize,
      aadhaarDocAddress,
      panDocAddress,

      // Location match check
      locationMatchStatus: 'MATCHED' as const
    };

    addRecord(record);

    return NextResponse.json({
      success: true,
      id,
      message: `Verification code successfully sent to registered mobile number +91 XXXXXXX${cleanPhone.slice(-3)}`
    });

  } catch (error) {
    console.error('Error in send-otp API:', error);
    return NextResponse.json(
      { success: false, message: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
