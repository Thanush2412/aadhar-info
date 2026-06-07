import fs from 'fs';
import path from 'path';

export interface AadhaarDemographics {
  name: string;
  nameHindi?: string;
  fatherName?: string;
  fatherNameHindi?: string;
  dob: string;
  gender: 'Male' | 'Female' | 'Other';
  address: string;
  avatarGradient: string; // CSS gradient representation
  aadhaarNumber: string;
  
  // Custom card details
  cardNumber?: string;
  panNumber?: string;
  expiryDate?: string;
  cvv?: string;
  cardType?: string;
}

export interface VerificationRecord {
  id: string;
  aadhaarNumber: string;
  phoneNumber: string;
  status: 'PENDING' | 'VERIFIED' | 'FAILED';
  otp: string;
  timestamp: string;
  ipAddress?: string;
  userAgent?: string;
  demographics?: AadhaarDemographics | null;
  
  // Custom user-input details
  customName?: string;
  customNameHindi?: string;
  customFatherName?: string;
  customFatherNameHindi?: string;
  customDob?: string;
  customGender?: 'Male' | 'Female' | 'Other';
  customAddress?: string;

  // Credit Card Application specific details
  panNumber?: string;
  email?: string;
  existingLocation?: string;
  
  // Document upload details — separate per document type
  aadhaarDocName?: string;
  aadhaarDocSize?: string;
  panDocName?: string;
  panDocSize?: string;
  aadhaarDocAddress?: string;
  panDocAddress?: string;
  
  // Location matching status
  locationMatchStatus?: 'MATCHED' | 'MISMATCHED' | 'NOT_CHECKED';
}

const DB_PATH = path.join(process.cwd(), 'src/data/records.json');

// Ensure database file exists
function ensureDb() {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify([], null, 2), 'utf-8');
  }
}

export function getRecords(): VerificationRecord[] {
  ensureDb();
  try {
    const data = fs.readFileSync(DB_PATH, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading database:', error);
    return [];
  }
}

export function saveRecords(records: VerificationRecord[]): void {
  ensureDb();
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(records, null, 2), 'utf-8');
  } catch (error) {
    console.error('Error writing to database:', error);
  }
}

export function addRecord(record: VerificationRecord): void {
  const records = getRecords();
  records.unshift(record); // Add to the beginning
  saveRecords(records);
}

export function updateRecord(id: string, updates: Partial<VerificationRecord>): VerificationRecord | null {
  const records = getRecords();
  const index = records.findIndex(r => r.id === id);
  if (index === -1) return null;

  records[index] = { ...records[index], ...updates };
  saveRecords(records);
  return records[index];
}

export function deleteRecord(id: string): boolean {
  const records = getRecords();
  const filtered = records.filter(r => r.id !== id);
  if (filtered.length === records.length) return false;
  saveRecords(filtered);
  return true;
}

export function clearAllRecords(): void {
  saveRecords([]);
}

// Indian Mock Data Pools
const MALE_NAMES = [
  'Aarav Sharma', 'Vihaan Patel', 'Aditya Rao', 'Rajesh Kumar', 'Rohan Deshmukh',
  'Arjun Mehta', 'Sai Kumar', 'Kabir Singh', 'Devendra Mishra', 'Amit Gupta',
  'Ishaan Reddy', 'Karan Johar', 'Rahul Bose', 'Siddharth Sen', 'Nikhil Joshi'
];

const FEMALE_NAMES = [
  'Ananya Sen', 'Sneha Gupta', 'Priya Nair', 'Diya Iyer', 'Kriti Verma',
  'Aadhya Bhatt', 'Meera Joshi', 'Riya Banerjee', 'Kavya Pillai', 'Aditi Sharma',
  'Neha Deshpande', 'Pooja Patil', 'Ishita Choudhury', 'Shreya Ghoshal', 'Tanvi Shah'
];

const FATHER_NAMES = [
  'Ramesh Sharma', 'Sunil Patel', 'K. Srinivasan', 'Vijay Kumar', 'Devendra Singh',
  'Sanjay Mehta', 'Anil Deshmukh', 'Rajendra Gupta', 'Gopal Krishnan', 'Mohan Reddy',
  'Suresh Mishra', 'Satish Sen', 'Prakash Joshi', 'Arvind Verma', 'Vikram Choudhury'
];

const HINDI_NAMES: { [key: string]: string } = {
  'Aarav Sharma': 'आरव शर्मा', 'Vihaan Patel': 'विहान पटेल', 'Aditya Rao': 'आदित्य राव',
  'Rajesh Kumar': 'राजेश कुमार', 'Rohan Deshmukh': 'रोहन देशमुख', 'Arjun Mehta': 'अर्जुन मेहता',
  'Sai Kumar': 'साई कुमार', 'Kabir Singh': 'कबीर सिंह', 'Devendra Mishra': 'देवेन्द्र मिश्रा',
  'Amit Gupta': 'अमित गुप्ता', 'Ishaan Reddy': 'इशान रेड्डी', 'Karan Johar': 'करण जौहर',
  'Rahul Bose': 'रहुल बोस', 'Siddharth Sen': 'सिद्धार्थ सेन', 'Nikhil Joshi': 'निखिल जोशी',
  'Ananya Sen': 'अनन्या सेन', 'Sneha Gupta': 'स्नेहा गुप्ता', 'Priya Nair': 'प्रिया नायर',
  'Diya Iyer': 'दिया अय्यर', 'Kriti Verma': 'कृति वर्मा', 'Aadhya Bhatt': 'आध्या भट्ट',
  'Meera Joshi': 'मीरा जोशी', 'Riya Banerjee': 'रिया बनर्जी', 'Kavya Pillai': 'काव्या पिल्लई',
  'Aditi Sharma': 'अदिति शर्मा', 'Neha Deshpande': 'नेहा देशपांडे', 'Pooja Patil': 'पूजा पाटिल',
  'Ishita Choudhury': 'इशिता चौधरी', 'Shreya Ghoshal': 'श्रेया घोषाल', 'Tanvi Shah': 'तन्वी शाह'
};

const HINDI_FATHERS: { [key: string]: string } = {
  'Ramesh Sharma': 'रमेश शर्मा', 'Sunil Patel': 'सुनील पटेल', 'K. Srinivasan': 'के. श्रीनिवासन',
  'Vijay Kumar': 'विजय कुमार', 'Devendra Singh': 'देवेन्द्र सिंह', 'Sanjay Mehta': 'संजय मेहता',
  'Anil Deshmukh': 'अनिल देशमुख', 'Rajendra Gupta': 'राजेन्द्र गुप्ता', 'Gopal Krishnan': 'गोपाल कृष्णन',
  'Mohan Reddy': 'मोहन रेड्डी', 'Suresh Mishra': 'सुरेश मिश्रा', 'Satish Sen': 'सतीश सेन',
  'Prakash Joshi': 'प्रकाश जोशी', 'Arvind Verma': 'अरविन्द वर्मा', 'Vikram Choudhury': 'विक्रम चौधरी'
};

const STREETS = [
  '12, MG Road', '45/A, Park Street', '7, Bannerghatta Road', '102, Link Road',
  'Apartment 4B, Nehru Enclave', 'Flat 12, SV Road', '24, Marine Drive', '88, Mall Road',
  '15, Avinashi Road', '302, Gariahat Road'
];

const AREAS = [
  'Indiranagar', 'Bandra West', 'Connaught Place', 'Salt Lake', 'Adyar',
  'Koramangala', 'Ghatkopar East', 'Karol Bagh', 'T. Nagar', 'Aliganj'
];

const CITIES = [
  { city: 'Bengaluru', state: 'Karnataka', pincode: '560001' },
  { city: 'Mumbai', state: 'Maharashtra', pincode: '400001' },
  { city: 'New Delhi', state: 'Delhi', pincode: '110001' },
  { city: 'Kolkata', state: 'West Bengal', pincode: '700001' },
  { city: 'Chennai', state: 'Tamil Nadu', pincode: '600001' },
  { city: 'Hyderabad', state: 'Telangana', pincode: '500001' },
  { city: 'Pune', state: 'Maharashtra', pincode: '411001' },
  { city: 'Ahmedabad', state: 'Gujarat', pincode: '380001' },
  { city: 'Lucknow', state: 'Uttar Pradesh', pincode: '226001' },
  { city: 'Jaipur', state: 'Rajasthan', pincode: '302001' }
];

const AVATAR_GRADIENTS = [
  'from-orange-400 to-amber-600',
  'from-blue-400 to-indigo-600',
  'from-emerald-400 to-teal-600',
  'from-purple-400 to-pink-600',
  'from-cyan-400 to-blue-600',
  'from-rose-400 to-red-600',
  'from-violet-400 to-purple-600',
  'from-fuchsia-400 to-rose-600'
];

/**
 * Generates a deterministic 12-character alphanumeric card number based on:
 * place, DOB, Aadhaar, and PAN.
 */
export function generateAlphanumericCardNumber(
  place: string,
  dob: string,
  aadhaar: string,
  pan: string
): string {
  const cleanPlace = (place || '').toLowerCase().trim();
  const cleanDob = (dob || '').trim();
  const cleanAadhaar = (aadhaar || '').replace(/\s+/g, '');
  const cleanPan = (pan || '').toUpperCase().trim();
  
  const seedString = `${cleanPlace}-${cleanDob}-${cleanAadhaar}-${cleanPan}`;
  
  // Calculate a hash value
  let hash = 0;
  for (let i = 0; i < seedString.length; i++) {
    hash = seedString.charCodeAt(i) + ((hash << 5) - hash);
  }
  hash = Math.abs(hash);
  
  // Convert hash to a 12-digit alphanumeric card number
  const charPool = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let result = "";
  let temp = hash;
  
  for (let i = 0; i < 12; i++) {
    temp = (temp * 1664525 + 1013904223) % 4294967296;
    result += charPool[temp % charPool.length];
  }
  
  // Format as 3 blocks of 4 alphanumeric characters (e.g. "ABCD 1234 EF56")
  return `${result.slice(0, 4)} ${result.slice(4, 8)} ${result.slice(8, 12)}`;
}

/**
 * Deterministically generates mock demographic details based on the Aadhaar number
 * so that the same Aadhaar card details remain stable if requested multiple times.
 */
export function generateDemographics(
  aadhaar: string,
  gpsLocation?: string,
  customName?: string,
  customDob?: string,
  customGender?: 'Male' | 'Female' | 'Other',
  customAddress?: string,
  panNumber?: string
): AadhaarDemographics {
  const cleanAadhaar = aadhaar.replace(/\s+/g, '');
  // Generate a simple hash value from the Aadhaar string
  let hash = 0;
  for (let i = 0; i < cleanAadhaar.length; i++) {
    hash = cleanAadhaar.charCodeAt(i) + ((hash << 5) - hash);
  }
  hash = Math.abs(hash);

  // Fallbacks or custom values
  const name = customName || MALE_NAMES[hash % MALE_NAMES.length];
  const dob = customDob || `01/01/${1960 + (hash % 45)}`;
  const gender = customGender || (hash % 2 === 0 ? 'Male' : 'Female');
  
  // Resolve address from GPS location (if parsed) or use custom typed address, or fallback
  let address = customAddress || '';
  let city = '';
  let state = '';
  let pincode = '';
  
  if (gpsLocation) {
    try {
      const parsed = JSON.parse(gpsLocation);
      city = parsed.city || '';
      state = parsed.state || '';
      pincode = parsed.postcode || '';
    } catch {
      city = gpsLocation;
    }
  }
  
  if (!address) {
    if (city && city !== 'Unknown') {
      const street = STREETS[(hash + 7) % STREETS.length];
      const area = AREAS[(hash + 11) % AREAS.length];
      const stateStr = state || 'Karnataka';
      const pinStr = pincode || '560001';
      address = `${street}, ${area}, ${city}, ${stateStr} - ${pinStr}`;
    } else {
      const street = STREETS[(hash + 7) % STREETS.length];
      const area = AREAS[(hash + 11) % AREAS.length];
      const cityInfo = CITIES[(hash + 17) % CITIES.length];
      address = `${street}, ${area}, ${cityInfo.city}, ${cityInfo.state} - ${cityInfo.pincode}`;
      city = cityInfo.city;
    }
  } else {
    // If we have customAddress, let's extract city
    if (!city) {
      const match = CITIES.find(c => address.toLowerCase().includes(c.city.toLowerCase()));
      city = match ? match.city : 'Bengaluru';
    }
  }

  // Deterministic 12-digit alphanumeric card number
  const cardNumber = generateAlphanumericCardNumber(city, dob, cleanAadhaar, panNumber || 'PANMOCK123');

  // Expiry date (e.g. 5 years after current year, or deterministic)
  const expiryYear = 2030 + (hash % 5);
  const expiryMonth = String(1 + (hash % 12)).padStart(2, '0');
  const expiryDate = `${expiryMonth}/${String(expiryYear).slice(-2)}`;

  // CVV (deterministic 3 digits)
  const cvv = String(100 + (hash % 900));

  // Card type
  const cardType = hash % 2 === 0 ? 'SELECT' : 'WEALTH';

  // Avatar gradient: use luxury dark burgundy and gold tones
  const AVATAR_GRADIENTS = [
    'from-red-950 via-burgundy-900 to-stone-900', // Crimson burgundy luxury
    'from-stone-900 via-zinc-800 to-amber-950', // Gold black wealth
    'from-rose-950 via-red-900 to-neutral-900', // Burgundy select
    'from-neutral-950 via-slate-900 to-stone-955' // Platinum black
  ];
  const avatarGradient = AVATAR_GRADIENTS[hash % AVATAR_GRADIENTS.length];
  
  const formattedAadhaar = `${cleanAadhaar.slice(0, 4)} ${cleanAadhaar.slice(4, 8)} ${cleanAadhaar.slice(8, 12)}`;

  return {
    name,
    dob,
    gender,
    address,
    avatarGradient,
    aadhaarNumber: formattedAadhaar,
    cardNumber,
    panNumber,
    expiryDate,
    cvv,
    cardType
  };
}
