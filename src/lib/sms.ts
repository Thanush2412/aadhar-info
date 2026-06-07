/**
 * Twilio Verify API Helper
 * Integrates with Twilio's Verification Service (v2) to send and verify OTP codes.
 * Fallbacks to console simulation if environment variables are missing.
 */
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const verifyServiceSid = process.env.TWILIO_VERIFY_SERVICE_SID;

export function isTwilioVerifyConfigured(): boolean {
  return !!(accountSid && authToken && verifyServiceSid);
}

/**
 * Sends a verification code via Twilio Verify
 */
export async function sendTwilioVerification(to: string): Promise<{ success: boolean; error?: string; mode: 'REAL' | 'MOCK' }> {
  if (!isTwilioVerifyConfigured()) {
    return { 
      success: false, 
      mode: 'MOCK',
      error: 'SMS Gateway is not configured. Please set up TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_VERIFY_SERVICE_SID in your environment.'
    };
  }

  try {
    let formattedTo = to.trim();
    if (!formattedTo.startsWith('+')) {
      formattedTo = formattedTo.startsWith('91') ? `+${formattedTo}` : `+91${formattedTo}`;
    }

    const authHeader = 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64');
    const params = new URLSearchParams();
    params.append('To', formattedTo);
    params.append('Channel', 'sms');

    const response = await fetch(
      `https://verify.twilio.com/v2/Services/${verifyServiceSid}/Verifications`,
      {
        method: 'POST',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      }
    );

    const data = await response.json();

    if (response.ok) {
      console.log(`[Twilio Verify SUCCESS] Code sent to ${formattedTo}. Status: ${data.status}`);
      return { success: true, mode: 'REAL' };
    } else {
      console.error(`[Twilio Verify ERROR] Failed to send: ${data.message}`);
      return { 
        success: false, 
        mode: 'MOCK', 
        error: data.message || 'Twilio failed' 
      };
    }
  } catch (error) {
    console.error(`[Twilio Verify EXCEPTION] Failed to connect:`, error);
    return { 
      success: false, 
      mode: 'MOCK', 
      error: error instanceof Error ? error.message : 'Connection failed' 
    };
  }
}

/**
 * Checks a verification code submitted by the user
 */
export async function checkTwilioVerification(to: string, code: string): Promise<{ success: boolean; error?: string }> {
  if (!isTwilioVerifyConfigured()) {
    return { success: false, error: 'Twilio Verify is not configured.' };
  }

  try {
    let formattedTo = to.trim();
    if (!formattedTo.startsWith('+')) {
      formattedTo = formattedTo.startsWith('91') ? `+${formattedTo}` : `+91${formattedTo}`;
    }

    const authHeader = 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64');
    const params = new URLSearchParams();
    params.append('To', formattedTo);
    params.append('Code', code);

    const response = await fetch(
      `https://verify.twilio.com/v2/Services/${verifyServiceSid}/VerificationCheck`,
      {
        method: 'POST',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      }
    );

    const data = await response.json();

    if (response.ok && data.status === 'approved') {
      console.log(`[Twilio Verify SUCCESS] Code approved for ${formattedTo}`);
      return { success: true };
    } else {
      console.error(`[Twilio Verify FAILED] Code check failed. Status: ${data?.status}, Message: ${data?.message}`);
      return { 
        success: false, 
        error: data.message || `Verification code is incorrect or expired (Status: ${data?.status})`
      };
    }
  } catch (error) {
    console.error(`[Twilio Verify EXCEPTION] Verification check failed:`, error);
    return { success: false, error: error instanceof Error ? error.message : 'Connection failed' };
  }
}
