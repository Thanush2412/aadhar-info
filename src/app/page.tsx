"use client"

import React, { useState, useEffect, useRef } from "react"
import Link from "next/link"
import { motion, AnimatePresence } from "framer-motion"
import { toast } from "sonner"
import {
  Fingerprint,
  Phone,
  ShieldCheck,
  ShieldAlert,
  Key,
  RefreshCw,
  Eye,
  EyeOff,
  Download,
  Activity,
  CheckCircle,
  Info,
  ArrowRight,
  FileText,
  Upload,
  MapPin,
  File,
  X,
  Lock,
  User,
  Calendar
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { isValidAadhaar, generateMockAadhaar } from "@/lib/verhoeff"
import { ThemeToggle } from "@/components/theme-toggle"

interface AadhaarDemographics {
  name: string;
  nameHindi?: string;
  fatherName?: string;
  fatherNameHindi?: string;
  dob: string;
  gender: 'Male' | 'Female' | 'Other';
  address: string;
  avatarGradient: string;
  aadhaarNumber: string;
  
  // Custom card details
  cardNumber?: string;
  panNumber?: string;
  expiryDate?: string;
  cvv?: string;
  cardType?: string;
}

export default function UnifiedKycPortal() {
  const [step, setStep] = useState<1 | 2>(1) // 1: Form entry & OTP, 2: Verification Result (Success Card / Mismatch Alert)
  
  // Form values
  const [nameInput, setNameInput] = useState("")
  const [dobInput, setDobInput] = useState("")
  const [aadhaarInput, setAadhaarInput] = useState("")
  const [phoneInput, setPhoneInput] = useState("")
  const [detectingLoc, setDetectingLoc] = useState(false)
  // Split address fields
  const [addrFlatNo, setAddrFlatNo] = useState("")
  const [addrStreet, setAddrStreet] = useState("")
  const [addrCity, setAddrCity] = useState("")
  const [addrState, setAddrState] = useState("")
  const [addrPin, setAddrPin] = useState("")
  const [existingLocation, setExistingLocation] = useState("") // Stores background resolved location city

  // Computed full address for API submission
  const typedAddress = [addrFlatNo, addrStreet, addrCity, addrState, addrPin].filter(Boolean).join(", ")
  
  // Validation states
  const [isValidAadhaarNum, setIsValidAadhaarNum] = useState(false)
  const [showAadhaarError, setShowAadhaarError] = useState(false)

  // Aadhaar Scan upload states
  const [aadhaarFile, setAadhaarFile] = useState<{ name: string; size: number } | null>(null)
  const [aadhaarUploadProgress, setAadhaarUploadProgress] = useState(0)
  const [aadhaarUploading, setAadhaarUploading] = useState(false)
  const [aadhaarUploadComplete, setAadhaarUploadComplete] = useState(false)
  const [aadhaarBase64, setAadhaarBase64] = useState("")
  const [aadhaarMimeType, setAadhaarMimeType] = useState("")
  const aadhaarInputRef = useRef<HTMLInputElement>(null)


  // Geolocation audit loading states
  const [locationLoading, setLocationLoading] = useState(false)

  // City autocomplete states (Ola Maps)
  const [citySuggestions, setCitySuggestions] = useState<any[]>([])
  const [cityLoading, setCityLoading] = useState(false)
  const [showCitySuggestions, setShowCitySuggestions] = useState(false)
  const cityDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // OTP Verification states
  const [showOtpModal, setShowOtpModal] = useState(false)
  const [loading, setLoading] = useState(false)
  const [txId, setTxId] = useState("")
  const [otpValues, setOtpValues] = useState(["", "", "", "", "", ""])
  const otpRefs = useRef<(HTMLInputElement | null)[]>([])
  const [timer, setTimer] = useState(60)

  // Result states
  const [demographics, setDemographics] = useState<AadhaarDemographics | null>(null)
  const [showFullAadhaar, setShowFullAadhaar] = useState(false)
  const [isFlipped, setIsFlipped] = useState(false)
  const [verificationError, setVerificationError] = useState<string | null>(null)

  // Document address OCR and verification states
  const [aadhaarDocAddress, setAadhaarDocAddress] = useState("")
  const [aadhaarDocUrl, setAadhaarDocUrl] = useState("")
  const [isOcrScanning, setIsOcrScanning] = useState(false)
  const [showOcrDetails, setShowOcrDetails] = useState(false)
  const [isDocumentVerified, setIsDocumentVerified] = useState(false)
  const [ocrRequested, setOcrRequested] = useState(false)
  const [locationDetectingBg, setLocationDetectingBg] = useState(true)
  const [locationError, setLocationError] = useState("")

  // AI Address Matching States
  const [isAddressMatching, setIsAddressMatching] = useState(false)
  const [addressMatchError, setAddressMatchError] = useState<string | null>(null)
  const [addressMatchBypassed, setAddressMatchBypassed] = useState(false)

  // Auto-format Aadhaar: XXXX XXXX XXXX
  const handleAadhaarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, "").slice(0, 12)
    let formatted = ""
    for (let i = 0; i < raw.length; i++) {
      if (i > 0 && i % 4 === 0) formatted += " "
      formatted += raw[i]
    }
    setAadhaarInput(formatted)
    setShowAadhaarError(false)

    if (raw.length === 12) {
      setIsValidAadhaarNum(isValidAadhaar(raw))
      if (!isValidAadhaar(raw)) {
        setShowAadhaarError(true)
      }
    } else {
      setIsValidAadhaarNum(false)
    }
  }


  // Generic file processor (shared)
  const simulateUpload = (
    selectedFile: File,
    setFile: (f: { name: string; size: number } | null) => void,
    setProgress: React.Dispatch<React.SetStateAction<number>>,
    setUploading: (v: boolean) => void,
    setComplete: (v: boolean) => void,
    label: string,
    setUrl: (url: string) => void
  ) => {
    if (selectedFile.size > 5 * 1024 * 1024) {
      toast.error("File too large", { description: "Maximum file size supported is 5MB." })
      return
    }
    setFile({ name: selectedFile.name, size: selectedFile.size })
    setUploading(true)
    setProgress(0)

    const appsScriptUrl = process.env.NEXT_PUBLIC_APPS_SCRIPT_URL

    if (!appsScriptUrl) {
      // Simulation fallback if no Apps Script URL is set
      const interval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 100) {
            clearInterval(interval)
            setUploading(false)
            setComplete(true)
            toast.success(`${label} uploaded successfully (Simulation Mode)!`)
            setUrl("https://drive.google.com/mock-file-url-for-simulation")
            return 100
          }
          return prev + 20
        })
      }, 150)
      return
    }

    // Real Google Apps Script Upload
    const reader = new FileReader()
    reader.onload = async () => {
      try {
        const base64Data = (reader.result as string).split(",")[1]
        if (label === "Aadhaar scan") {
          setAadhaarBase64(base64Data)
          setAadhaarMimeType(selectedFile.type)
        }
        setProgress(30)
        
        const response = await fetch(appsScriptUrl, {
          method: "POST",
          mode: "cors",
          headers: {
            "Content-Type": "text/plain;charset=utf-8"
          },
          body: JSON.stringify({
            action: "upload",
            filename: selectedFile.name,
            mimeType: selectedFile.type,
            base64Data: base64Data
          })
        })
        
        setProgress(70)
        const data = await response.json()
        
        if (data && data.success) {
          setProgress(100)
          setUploading(false)
          setComplete(true)
          setUrl(data.fileUrl)
          toast.success(`${label} uploaded to Google Drive successfully!`)
        } else {
          console.error("Apps Script Upload Error:", data.error)
          toast.error(`Upload failed: ${data.error || "Unknown server error"}`)
          setUploading(false)
          setComplete(false)
          setFile(null)
        }
      } catch (error: any) {
        console.error("Upload network error:", error)
        toast.error(`Upload failed: ${error.message || error}`)
        setUploading(false)
        setComplete(false)
        setFile(null)
      }
    }
    
    reader.onerror = () => {
      toast.error("Failed to read file from disk.")
      setUploading(false)
      setFile(null)
    }
    
    reader.readAsDataURL(selectedFile)
  }

  // Aadhaar scan handlers
  const processAadhaarFile = (f: File) => simulateUpload(f, setAadhaarFile, setAadhaarUploadProgress, setAadhaarUploading, setAadhaarUploadComplete, "Aadhaar scan", setAadhaarDocUrl)
  const handleAadhaarFileChange = (e: React.ChangeEvent<HTMLInputElement>) => { const f = e.target.files?.[0]; if (f) processAadhaarFile(f) }
  const handleAadhaarDrop = (e: React.DragEvent) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) processAadhaarFile(f) }
  const removeAadhaarFile = () => { setAadhaarFile(null); setAadhaarUploadComplete(false); setAadhaarUploadProgress(0); setOcrRequested(false); if (aadhaarInputRef.current) aadhaarInputRef.current.value = "" }


  // Shared drag over handler
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault() }

  // City autocomplete via Nominatim (free, no API key)
  const fetchCitySuggestions = async (query: string) => {
    if (query.trim().length < 3) { setCitySuggestions([]); return }
    setCityLoading(true)
    try {
      const res = await fetch(
        `/api/verify/autocomplete?input=${encodeURIComponent(query)}`
      )
      const data = await res.json()
      setCitySuggestions(data.predictions || [])
      setShowCitySuggestions(true)
    } catch {
      setCitySuggestions([])
    } finally {
      setCityLoading(false)
    }
  }

  const handleCityInputChange = (val: string) => {
    setAddrCity(val)
    if (cityDebounceRef.current) clearTimeout(cityDebounceRef.current)
    cityDebounceRef.current = setTimeout(() => fetchCitySuggestions(val), 400)
  }

  const selectCitySuggestion = async (item: any) => {
    const placeId = item.place_id
    try {
      const res = await fetch(`/api/verify/details?place_id=${placeId}`)
      const detailData = await res.json()
      if (detailData && detailData.result) {
        const result = detailData.result
        const comps = result.address_components || []
        
        let city = ""
        let state = ""
        let postcode = ""
        
        for (const comp of comps) {
          const types = comp.types || []
          if (types.includes("locality")) {
            city = comp.long_name
          } else if (types.includes("administrative_area_level_1")) {
            state = comp.long_name
          } else if (types.includes("postal_code")) {
            postcode = comp.long_name
          }
        }
        
        if (!city) {
          const localityComp = comps.find((c: any) => c.types.includes("administrative_area_level_2"))
          if (localityComp) {
            city = localityComp.long_name
          }
        }

        if (!city) {
          city = item.structured_formatting?.main_text || item.description.split(",")[0].trim()
        }
        if (!state) {
          const parts = item.description.split(",")
          if (parts.length > 2) {
            state = parts[parts.length - 2].trim()
          }
        }
        
        setAddrCity(city)
        if (state) setAddrState(state)
        if (postcode) setAddrPin(postcode)
        
        const gpsDetails = {
          city: city || "Unknown",
          state: state || "Unknown",
          postcode: postcode || "Unknown",
          displayName: result.formatted_address || item.description
        }
        setExistingLocation(JSON.stringify(gpsDetails))
      }
    } catch (e) {
      console.error("Error fetching place details:", e)
      const city = item.structured_formatting?.main_text || item.description.split(",")[0].trim()
      let state = ""
      const parts = item.description.split(",")
      if (parts.length > 2) {
        state = parts[parts.length - 2].trim()
      }
      setAddrCity(city)
      if (state) setAddrState(state)
      const gpsDetails = {
        city,
        state,
        postcode: "Unknown",
        displayName: item.description
      }
      setExistingLocation(JSON.stringify(gpsDetails))
    }
    setCitySuggestions([])
    setShowCitySuggestions(false)
  }

  const getDisplayLocation = (locStr: string) => {
    if (!locStr) return "Unknown"
    try {
      const parsed = JSON.parse(locStr)
      return parsed.displayName || `${parsed.city}, ${parsed.state}`
    } catch {
      return locStr
    }
  }

  const performGeocoding = async (lat: number, lng: number, fillFormFields: boolean) => {
    try {
      const res = await fetch(`/api/verify/reverse-geocode?lat=${lat}&lng=${lng}`)
      const geoData = await res.json()
      const results = geoData.results || geoData.geocodingResults
      if (geoData && (geoData.status === "ok" || geoData.status === "success") && results && results.length > 0) {
        const result = results[0]
        const comps = result.address_components || []
        
        let houseNumber = ""
        let road = ""
        let sublocality = ""
        let neighborhood = ""
        let city = ""
        let state = ""
        let postcode = ""
        
        // Collect ALL component names as candidates (cast wide net across all locality levels)
        const candidateSet = new Set<string>()

        for (const comp of comps) {
          const types: string[] = comp.types || []
          const name: string = (comp.long_name || "").trim()

          // Structured field extraction
          if (types.some(t => ["premise","subpremise","street_number","house_number","building"].includes(t))) {
            houseNumber = name
          } else if (types.includes("route")) {
            road = name
          } else if (types.some(t => t.startsWith("sublocality"))) {
            // catches sublocality, sublocality_level_1, sublocality_level_2, etc.
            if (!sublocality) sublocality = name
          } else if (types.includes("neighborhood")) {
            neighborhood = name
          } else if (types.includes("locality")) {
            city = name
          } else if (types.includes("administrative_area_level_1")) {
            state = name
          } else if (types.includes("postal_code")) {
            postcode = name
          }

          // Add every meaningful component as a candidate (excludes country, postal_code, state)
          const skipTypes = ["country", "postal_code", "administrative_area_level_1", "premise", "subpremise", "street_number", "house_number", "building", "route"]
          if (!types.some(t => skipTypes.includes(t)) && name && name.length > 2) {
            candidateSet.add(name)
          }
        }

        // Fallback city from district level
        if (!city) {
          const districtComp = comps.find((c: any) =>
            c.types.includes("administrative_area_level_2") || c.types.includes("administrative_area_level_3")
          )
          if (districtComp) city = districtComp.long_name
        }

        // Always add the resolved city
        if (city && city !== "Unknown") candidateSet.add(city)

        // Also parse the formatted_address — split on comma, trim each segment
        // This catches names like "Coimbatore" that might appear in the full address string
        // even if the component typing was different
        const formattedAddr: string = result.formatted_address || ""
        if (formattedAddr) {
          formattedAddr.split(",").forEach((seg: string) => {
            const s = seg.trim()
            // Skip numeric-only segments (postcodes) and very short/long segments
            if (s && s.length > 2 && s.length < 60 && !/^\d+$/.test(s) && !["India"].includes(s)) {
              candidateSet.add(s)
            }
          })
        }

        const candidates = Array.from(candidateSet)
        const streetInfo = [road, sublocality, neighborhood].filter(Boolean).join(", ")
        
        if (fillFormFields) {
          setAddrFlatNo(houseNumber)
          setAddrStreet(streetInfo)
          setAddrCity(city)
          setAddrPin(postcode)
          setAddrState(state)
        }
        
        const gpsDetails = {
          city: city || "Unknown",
          candidates,
          state: state || "Unknown",
          postcode: postcode || "Unknown",
          displayName: formattedAddr || "Unknown"
        }
        setExistingLocation(JSON.stringify(gpsDetails))
        setLocationError("")
        return gpsDetails
      }
    } catch (error) {
      console.error("Geocoding resolution error:", error)
    }
    return null
  }

  const performIpGeocoding = async (fillFormFields: boolean) => {
    try {
      const res = await fetch("https://ipwho.is/")
      const data = await res.json()
      if (data && data.success) {
        const candidates = [data.city, data.region].filter(Boolean)
        const gpsDetails = {
          city: data.city || "Unknown",
          candidates: candidates,
          state: data.region || "Unknown",
          postcode: data.postal || "Unknown",
          displayName: `${data.city || ""}, ${data.region || ""}, ${data.country || ""}`
        }
        if (fillFormFields) {
          setAddrCity(data.city || "")
          setAddrState(data.region || "")
          setAddrPin(data.postal || "")
        }
        setExistingLocation(JSON.stringify(gpsDetails))
        setLocationError("")
        return gpsDetails
      } else {
        setLocationError(data.message || "IP lookup returned success: false")
      }
    } catch (error: any) {
      console.error("IP geocoding resolution error:", error)
      setLocationError(`IP fallback failed: ${error.message || error}`)
    }
    return null
  }

  const autoDetectLocation = () => {
    setDetectingLoc(true)
    setLocationError("")

    const runIpFallback = async () => {
      const details = await performIpGeocoding(true)
      if (details) {
        toast.success("Location resolved via IP Geolocation!", {
          description: `Filled address for: ${details.city}, ${details.state}`
        })
      } else {
        toast.error("Location detection failed", {
          description: "Please check your internet connection or choose city manually."
        })
      }
      setDetectingLoc(false)
    }

    const isInsecureNetwork = typeof window !== "undefined" && !window.isSecureContext && window.location.hostname !== "localhost"

    if (isInsecureNetwork) {
      runIpFallback()
    } else if (navigator.geolocation) {
      const options = {
        enableHighAccuracy: true,
        timeout: 8000,
        maximumAge: 0
      }

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const details = await performGeocoding(position.coords.latitude, position.coords.longitude, true)
          if (!details) {
            await runIpFallback()
          } else {
            toast.success("Location coordinates resolved!", {
              description: `Filled address for: ${details.city}, ${details.state}`
            })
            setDetectingLoc(false)
          }
        },
        async (error) => {
          console.warn("GPS Geolocation failed, trying low accuracy fallback...", error.message)
          options.enableHighAccuracy = false
          navigator.geolocation.getCurrentPosition(
            async (pos) => {
              const details = await performGeocoding(pos.coords.latitude, pos.coords.longitude, true)
              if (!details) await runIpFallback()
              else {
                toast.success("Location coordinates resolved!", {
                  description: `Filled address for: ${details.city}, ${details.state}`
                })
                setDetectingLoc(false)
              }
            },
            async (err) => {
              console.warn("Low accuracy GPS failed, falling back to IP Geolocation:", err.message)
              await runIpFallback()
            },
            options
          )
        },
        options
      )
    } else {
      runIpFallback()
    }
  }

  // Send e-KYC Data to Backend API
  // Send e-KYC Data to Backend API
  const submitVerificationData = async (cleanAadhaar: string, resolvedLocation: string) => {
    // Check if we need to verify typed address against Aadhaar address via AI
    if (aadhaarDocAddress && aadhaarDocAddress !== "Bypassed - Test Mode" && !addressMatchBypassed) {
      setIsAddressMatching(true)
      try {
        const matchResponse = await fetch("/api/verify/match-address", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            typedAddress,
            aadhaarDocAddress
          })
        })
        const matchData = await matchResponse.json()
        setIsAddressMatching(false)

        if (matchData.success && !matchData.match) {
          setAddressMatchError(matchData.reason || "Address matching failed.")
          setLoading(false)
          setLocationLoading(false)
          return
        }
      } catch (error) {
        setIsAddressMatching(false)
        console.error("Failed to compare addresses:", error)
        setAddressMatchError("Failed to verify address alignment with AI model. Connection failed.")
        setLoading(false)
        setLocationLoading(false)
        return
      }
    }

    try {
      const response = await fetch("/api/verify/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          aadhaarNumber: cleanAadhaar,
          phoneNumber: phoneInput,
          panNumber: "N/A",
          customAddress: typedAddress,
          customName: nameInput,
          customDob: dobInput.split('-').reverse().join('/'), // format YYYY-MM-DD to DD/MM/YYYY
          existingLocation: resolvedLocation,
          aadhaarDocName: aadhaarFile ? aadhaarFile.name : "aadhaar_unnamed.pdf",
          aadhaarDocSize: aadhaarFile ? `${(aadhaarFile.size / 1024).toFixed(1)} KB` : "0 KB",
          panDocName: "N/A",
          panDocSize: "0 KB",
          aadhaarDocAddress,
          panDocAddress: "N/A"
        })
      })
      const data = await response.json()

      if (data.success) {
        setTxId(data.id)
        setShowOtpModal(true)
        setTimer(60)
        setOtpValues(["", "", "", "", "", ""])
        toast.success("Verification code dispatched!")
      } else {
        toast.error("Verification failed", { description: data.message })
      }
    } catch {
      toast.error("Error connecting to gateway.")
    } finally {
      setLoading(false)
      setLocationLoading(false)
    }
  }

  // Submit main form: Request OTP verification with background location check
  const handleRequestVerification = async (e: React.FormEvent) => {
    e.preventDefault()
    
    const cleanAadhaar = aadhaarInput.replace(/\s+/g, "")
    if (!isValidAadhaar(cleanAadhaar)) {
      toast.error("Invalid Aadhaar format or checksum")
      setShowAadhaarError(true)
      return
    }

    if (!/^[6-9]\d{9}$/.test(phoneInput)) {
      toast.error("Invalid phone number")
      return
    }

    if (!typedAddress.trim()) {
      toast.error("Please enter your residential address")
      return
    }

    setLoading(true)
    setLocationLoading(true)

    if (existingLocation) {
      submitVerificationData(cleanAadhaar, existingLocation)
      return
    }

    // Background Geolocation checking
    if (typeof window !== "undefined" && !window.isSecureContext && window.location.hostname !== "localhost") {
      toast.error("HTTPS Required on Mobile", {
        description: "Your mobile browser requires a secure HTTPS connection to authorize GPS location permission. Run 'npm run dev-https' or use ngrok."
      })
      setLoading(false)
      setLocationLoading(false)
      return
    }
    if (!navigator.geolocation) {
      toast.error("Geolocation is not supported by your browser.")
      setLoading(false)
      setLocationLoading(false)
      return
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords
        const details = await performGeocoding(latitude, longitude, false)
        if (details) {
          submitVerificationData(cleanAadhaar, JSON.stringify(details))
        } else {
          toast.error("Could not resolve location coordinates.")
          setLoading(false)
          setLocationLoading(false)
        }
      },
      (error) => {
        console.error("Geolocation error:", error.message || error);
        toast.error("Location permission denied or timed out. GPS access is required for GPS verification.")
        setLoading(false)
        setLocationLoading(false)
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0
      }
    )
  }

  // OTP Timer countdown
  useEffect(() => {
    if (!showOtpModal || timer <= 0) return
    const interval = setInterval(() => {
      setTimer((prev) => prev - 1)
    }, 1000)
    return () => clearInterval(interval)
  }, [showOtpModal, timer])

  // Background Geolocation on page load (Real-time GPS Watcher)
  useEffect(() => {
    let watchId: number | null = null;
    const isInsecureNetwork = typeof window !== "undefined" && !window.isSecureContext && window.location.hostname !== "localhost";

    const runBackgroundIpFallback = async (gpsErrorMsg?: string) => {
      const details = await performIpGeocoding(false)
      if (!details && gpsErrorMsg) {
        setLocationError(`GPS block: ${gpsErrorMsg}. IP fallback failed.`)
      }
      setLocationDetectingBg(false)
    }

    if (navigator.geolocation && !isInsecureNetwork) {
      watchId = navigator.geolocation.watchPosition(
        async (position) => {
          console.log("Real-time GPS update:", position.coords.latitude, position.coords.longitude, "accuracy:", position.coords.accuracy)
          const details = await performGeocoding(position.coords.latitude, position.coords.longitude, false)
          if (!details) {
            await runBackgroundIpFallback("Reverse-geocode parse failure")
          } else {
            setLocationDetectingBg(false)
            setLocationError("")
          }
        },
        async (error) => {
          console.warn("Real-time GPS watcher failed, trying IP Geolocation fallback:", error.message || error)
          await runBackgroundIpFallback(error.message)
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
      )
    } else {
      runBackgroundIpFallback(isInsecureNetwork ? "HTTP origin blocked GPS" : "Geolocation API unsupported")
    }

    return () => {
      if (watchId !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchId)
      }
    }
  }, [])

  const checkGpsAlignment = (docAddr: string, locStr: string): boolean => {
    if (!locStr) return false
    try {
      const parsed = JSON.parse(locStr)
      const candidates = parsed.candidates || [parsed.city]
      const docLower = docAddr.toLowerCase()
      
      return candidates.some((cand: string) => {
        if (!cand || cand.toLowerCase() === 'unknown') return false
        const candLower = cand.toLowerCase().trim()
        return docLower.includes(candLower) ||
               (candLower === 'delhi' && docLower.includes('new delhi')) ||
               (candLower === 'new delhi' && docLower.includes('delhi'))
      })
    } catch {
      const gpsCityLower = locStr.toLowerCase().trim()
      if (!gpsCityLower || gpsCityLower === 'unknown') return false
      const docLower = docAddr.toLowerCase()
      return docLower.includes(gpsCityLower)
    }
  }

  // Real Gemini OCR Address scan once Aadhaar file is fully uploaded
  useEffect(() => {
    if (aadhaarUploadComplete && aadhaarBase64 && ocrRequested && !aadhaarDocAddress) {
      setIsOcrScanning(true)
      
      console.log("Calling Gemini OCR API via backend...")
      fetch("/api/verify/ocr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64: aadhaarBase64,
          mimeType: aadhaarMimeType
        })
      })
      .then(res => res.json())
      .then(data => {
        setIsOcrScanning(false)
        setShowOcrDetails(true)
        if (data.success && data.address) {
          setAadhaarDocAddress(data.address)
          const gpsMatch = checkGpsAlignment(data.address, existingLocation)
          setIsDocumentVerified(gpsMatch)
          
          if (gpsMatch) {
            toast.success("Aadhaar Address Verified Successfully!", {
              description: "Extracted Aadhaar address aligns with your current GPS location."
            })
          } else {
            toast.error("Aadhaar Address Match Failed", {
              description: `Aadhaar address does not align with your physical location. Submission is locked.`
            })
          }
        } else {
          toast.error("OCR Address Extraction Failed", {
            description: data.error || "Could not read address from Aadhaar card. Ensure the scan is clear."
          })
          // Set a default to prevent locking the application completely if AI fails
          setAadhaarDocAddress("Address Extraction Failed - Please retry")
          setIsDocumentVerified(false)
        }
      })
      .catch(err => {
        setIsOcrScanning(false)
        console.error("OCR API error:", err)
        toast.error("OCR connection failed.")
      })
    }
  }, [aadhaarUploadComplete, aadhaarBase64, existingLocation])

  // Reactively verify document address alignment when Aadhaar address or GPS location changes
  useEffect(() => {
    if (aadhaarDocAddress) {
      const gpsMatch = checkGpsAlignment(aadhaarDocAddress, existingLocation)
      setIsDocumentVerified(gpsMatch)
    } else {
      setIsDocumentVerified(false)
    }
  }, [aadhaarDocAddress, existingLocation])

  // Handle OTP Inputs focus shift
  const handleOtpChange = (index: number, val: string) => {
    const cleanVal = val.replace(/\D/g, "").slice(-1)
    const newValues = [...otpValues]
    newValues[index] = cleanVal
    setOtpValues(newValues)

    if (cleanVal !== "" && index < 5) {
      otpRefs.current[index + 1]?.focus()
    }
  }

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && otpValues[index] === "" && index > 0) {
      const newValues = [...otpValues]
      newValues[index - 1] = ""
      setOtpValues(newValues)
      otpRefs.current[index - 1]?.focus()
    }
  }

  // Resend OTP
  const handleResendOtp = async () => {
    if (timer > 0) return
    setLoading(true)
    try {
      const response = await fetch("/api/verify/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          aadhaarNumber: aadhaarInput.replace(/\s+/g, ""), 
          phoneNumber: phoneInput,
          panNumber: "N/A",
          customAddress: typedAddress,
          existingLocation: existingLocation,
          aadhaarDocName: aadhaarFile ? aadhaarFile.name : "aadhaar_unnamed.pdf",
          aadhaarDocSize: aadhaarFile ? `${(aadhaarFile.size / 1024).toFixed(1)} KB` : "0 KB",
          panDocName: "N/A",
          panDocSize: "0 KB",
          aadhaarDocAddress,
          panDocAddress: "N/A"
        })
      })
      const data = await response.json()
      if (data.success) {
        setTxId(data.id)
        setTimer(60)
        setOtpValues(["", "", "", "", "", ""])
        toast.success(data.message || "New verification code sent successfully!")
      } else {
        toast.error("Failed to resend OTP", { description: data.message })
      }
    } catch {
      toast.error("Error connecting to server.")
    } finally {
      setLoading(false)
    }
  }

  // Verify e-KYC OTP & trigger location check
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    const otp = otpValues.join("")
    if (otp.length !== 6) {
      toast.error("Enter a complete 6-digit OTP code.")
      return
    }

    setLoading(true)
    try {
      const response = await fetch("/api/verify/confirm-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: txId, otp })
      })
      const data = await response.json()

      if (data.success) {
        setDemographics(data.demographics)
        setVerificationError(null)
        setShowOtpModal(false)
        setStep(2)
        toast.success("Verification Succeeded!", {
          description: "All records matched successfully."
        })

        // Log verification details to Google Sheets asynchronously
        const appsScriptUrl = process.env.NEXT_PUBLIC_APPS_SCRIPT_URL
        if (appsScriptUrl) {
          fetch(appsScriptUrl, {
            method: "POST",
            mode: "cors",
            headers: {
              "Content-Type": "text/plain;charset=utf-8"
            },
            body: JSON.stringify({
              action: "log_verification",
              name: nameInput,
              dob: dobInput.split('-').reverse().join('/'),
              aadhaar: aadhaarInput,
              phone: phoneInput,
              pan: "N/A",
              gpsAddress: typedAddress,
              aadhaarDocUrl: aadhaarDocUrl || "N/A",
              panDocUrl: "N/A",
              txId: txId
            })
          }).then(res => res.json())
            .then(resData => {
              if (resData && resData.success) {
                console.log("Logged verification to Google Sheet successfully.")
              } else {
                console.error("Failed to log to Google Sheet:", resData.error)
              }
            })
            .catch(err => {
              console.error("Sheet logging network error:", err)
            })
        }
      } else {
        // Mismatch or Verification failure
        setShowOtpModal(false)
        setVerificationError(data.message || "Verification Failed.")
        setStep(2)
        toast.error("Security Alert", {
          description: data.message || "Location coordinates do not match Aadhaar details."
        })
      }
    } catch {
      toast.error("Connection failed.")
    } finally {
      setLoading(false)
    }
  }

  const handleReset = () => {
    setStep(1)
    setNameInput("")
    setDobInput("")
    setAadhaarInput("")
    setPhoneInput("")
    setAddrFlatNo(""); setAddrStreet(""); setAddrCity(""); setAddrState(""); setAddrPin("")
    setExistingLocation("")
    setAadhaarFile(null); setAadhaarUploadComplete(false); setAadhaarUploadProgress(0)
    setDemographics(null)
    setVerificationError(null)
    setAadhaarDocAddress("")
    setAadhaarDocUrl("")
    setShowOcrDetails(false)
    setIsOcrScanning(false)
    setOcrRequested(false)
    setIsAddressMatching(false)
    setAddressMatchError(null)
    setAddressMatchBypassed(false)
  }

  const handleReVerifyLocation = () => {
    setStep(1)
    setVerificationError(null)
    setExistingLocation("")
    autoDetectLocation()
  }

  const isFormValid = () => {
    return (
      nameInput.trim().length > 0 &&
      dobInput.trim().length > 0 &&
      isValidAadhaarNum &&
      /^[6-9]\d{9}$/.test(phoneInput) &&
      addrFlatNo.trim().length > 0 &&
      addrStreet.trim().length > 0 &&
      addrCity.trim().length > 0 &&
      addrState.trim().length > 0 &&
      /^[1-9][0-9]{5}$/.test(addrPin) &&
      aadhaarUploadComplete &&
      aadhaarDocAddress.trim().length > 0
    )
  }

  return (
    <div className="flex-1 min-h-screen bg-background text-foreground flex flex-col font-sans relative overflow-hidden transition-colors duration-300">
      
      {/* Glow Effects */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[60%] rounded-full bg-rose-900/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[50%] rounded-full bg-amber-950/10 blur-[120px] pointer-events-none" />

      {/* Header */}
      <header className="border-b border-border bg-background/80 backdrop-blur-md sticky top-0 z-50 px-6 py-4 flex items-center justify-between transition-colors">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-tr from-rose-900 via-amber-500 to-rose-700 p-[2px] rounded-lg">
            <div className="bg-card p-2 rounded-[6px]">
              <Fingerprint className="h-6 w-6 text-rose-700 dark:text-rose-500 animate-pulse" />
            </div>
          </div>
          <div>
            <h1 className="font-bold text-lg leading-none tracking-wide bg-gradient-to-r from-rose-700 via-foreground to-amber-600 dark:from-rose-500 dark:via-slate-100 dark:to-amber-500 bg-clip-text text-transparent">
              GPS PORTAL
            </h1>
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest mt-1">Premium Identity &amp; GPS Card Verification</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <ThemeToggle />
        </div>
      </header>

      {/* Main Body */}
      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-8 flex flex-col items-center justify-center relative z-10">
        
        <AnimatePresence mode="wait">
          
          {/* STEP 1: FORM APPLICATION */}
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.3 }}
              className="w-full max-w-2xl"
            >
              <Card className="bg-card/75 border-border backdrop-blur-xl shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-[3px] bg-[#8C002B]" />
                <CardHeader className="pb-4">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <ShieldCheck className="h-4.5 w-4.5 text-rose-600 dark:text-rose-500" />
                    </div>
                    <div>
                      <CardTitle className="text-base font-semibold text-foreground tracking-tight">
                        Identity &amp; GPS Card Application
                      </CardTitle>
                      <CardDescription className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                        Complete all fields accurately. Your credentials and GPS physical location will be audited.
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                
                <form onSubmit={handleRequestVerification}>
                  <CardContent className="space-y-4">
                    
                    {/* Background GPS Location Status */}
                    <div className="p-3 bg-muted/40 border border-border rounded-lg flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-[#8C002B] animate-pulse" />
                        <div>
                          <p className="font-semibold text-foreground">Current GPS Location</p>
                          <p className="text-[10px] text-muted-foreground">
                            {(locationDetectingBg || detectingLoc) 
                              ? "Resolving coordinates..." 
                              : existingLocation 
                                ? getDisplayLocation(existingLocation) 
                                : locationError || "Location failed"}
                          </p>
                        </div>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                        (locationDetectingBg || detectingLoc) 
                          ? "bg-amber-500/10 text-amber-500 animate-pulse" 
                          : existingLocation 
                            ? "bg-emerald-500/10 text-emerald-500" 
                            : "bg-rose-500/10 text-rose-500"
                      }`}>
                        {(locationDetectingBg || detectingLoc) ? "RESOLVING" : existingLocation ? "RESOLVED" : "FAILED"}
                      </span>
                    </div>

                    {/* Document Scans (Uploaded First) */}
                    <div className="space-y-2 text-left">
                      <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                        <Upload className="h-3.5 w-3.5 text-rose-700" />
                        Upload Aadhaar Card Screenshot
                      </label>
                      <p className="text-[10px] text-muted-foreground leading-normal pb-1">
                        Upload Aadhaar card screenshot. The system will scan it via Gemini OCR to verify if the document address aligns with your physical GPS location.
                      </p>
                      
                      <div className="grid grid-cols-1 gap-3">
                        {/* Aadhaar Card Scan */}
                        <div className="space-y-1">
                          <p className="text-[10px] font-medium text-muted-foreground flex items-center gap-1">
                            <Fingerprint className="h-3 w-3 text-rose-700 dark:text-rose-500" /> Aadhaar Card Scan
                          </p>
                          <div
                            onDragOver={handleDragOver}
                            onDrop={handleAadhaarDrop}
                            onClick={() => aadhaarInputRef.current?.click()}
                            className={`border-2 border-dashed rounded-lg p-4 flex flex-col items-center justify-center cursor-pointer transition bg-background/50 hover:bg-muted/30 ${
                              aadhaarUploadComplete ? "border-emerald-500/50" : "border-border"
                            }`}
                          >
                            <input
                              type="file"
                              ref={aadhaarInputRef}
                              onChange={handleAadhaarFileChange}
                              accept=".pdf,.png,.jpg,.jpeg"
                              className="hidden"
                            />
                            {!aadhaarFile ? (
                              <>
                                <Upload className="h-5 w-5 text-muted-foreground mb-1" />
                                 <p className="text-[10px] text-muted-foreground text-center">
                                  Drag & drop or <span className="text-rose-700 dark:text-rose-500 font-semibold">browse</span>
                                </p>
                                <p className="text-[9px] text-muted-foreground mt-0.5">PDF / PNG / JPG (Max 5MB)</p>
                              </>
                            ) : (
                              <div className="w-full flex items-center justify-between" onClick={(e) => e.stopPropagation()}>
                                <div className="flex items-center gap-1.5">
                                  <div className="p-1.5 rounded bg-rose-500/10 text-rose-700 dark:text-rose-500">
                                    <File className="h-4 w-4" />
                                  </div>
                                  <div className="text-left">
                                    <p className="text-[10px] font-semibold text-foreground truncate max-w-[120px]">{aadhaarFile.name}</p>
                                    <p className="text-[9px] text-muted-foreground">{(aadhaarFile.size / 1024).toFixed(1)} KB</p>
                                  </div>
                                </div>
                                {aadhaarUploading && (
                                  <div className="flex items-center gap-1">
                                    <span className="text-[9px] font-mono text-muted-foreground">{aadhaarUploadProgress}%</span>
                                    <div className="w-12 h-1 bg-muted rounded-full overflow-hidden">
                                      <div className="h-full bg-[#8C002B]" style={{ width: `${aadhaarUploadProgress}%` }} />
                                    </div>
                                  </div>
                                )}
                                {aadhaarUploadComplete && (
                                  <div className="flex items-center gap-1">
                                    <span className="text-[9px] font-bold text-emerald-500 flex items-center gap-0.5">
                                      <CheckCircle className="h-3 w-3" /> Ready
                                    </span>
                                    <button onClick={removeAadhaarFile} className="text-muted-foreground hover:text-rose-500 p-0.5">
                                      <X className="h-3.5 w-3.5" />
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* PAN Card Scan (Removed as PAN is no longer required) */}
                      </div>
                    </div>

                    {/* Choose Verification Path (AI OCR vs Bypass) BEFORE OCR starts */}
                    {aadhaarUploadComplete && !ocrRequested && !isDocumentVerified && (
                      <div className="p-4 bg-muted/40 border border-border rounded-lg space-y-3 text-left my-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <div className="flex items-start gap-2.5">
                          <Info className="h-4 w-4 text-[#8C002B] mt-0.5 flex-shrink-0 animate-pulse" />
                          <div>
                            <p className="text-xs font-bold text-foreground uppercase tracking-wider">Aadhaar Card Uploaded</p>
                            <p className="text-[10px] text-muted-foreground mt-0.5 leading-normal">
                              Select a verification method to check if the residential address matches your current GPS location.
                            </p>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                          <Button
                            type="button"
                            onClick={() => setOcrRequested(true)}
                            className="text-[10px] h-9 bg-[#8C002B] hover:bg-[#700022] text-white font-semibold flex items-center justify-center gap-1.5 cursor-pointer rounded-lg border-none shadow-sm"
                          >
                            <RefreshCw className="h-3.5 w-3.5" />
                            Verify with AI OCR
                          </Button>
                          <Button
                            type="button"
                            onClick={() => {
                              setAadhaarDocAddress("Bypassed - Test Mode")
                              setIsDocumentVerified(true)
                              setShowOcrDetails(true)
                              toast.success("AI verification bypassed successfully!")
                            }}
                            className="text-[10px] h-9 bg-amber-600/20 hover:bg-amber-600/30 text-amber-500 border border-amber-500/20 font-semibold flex items-center justify-center gap-1.5 cursor-pointer rounded-lg"
                          >
                            <Lock className="h-3.5 w-3.5" />
                            Bypass Verification
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* OCR Scanner Progress / Details */}
                    {isOcrScanning && (
                      <div className="p-4 bg-muted/30 border border-dashed border-rose-900/40 rounded-lg flex flex-col items-center justify-center gap-2 py-6 my-4">
                        <RefreshCw className="h-6 w-6 text-rose-700 dark:text-rose-500 animate-spin" />
                        <p className="text-xs font-semibold text-foreground">Scanning Document Address via OCR...</p>
                        <p className="text-[10px] text-muted-foreground font-mono">Reading physical address candidates and comparing indices.</p>
                      </div>
                    )}

                    {showOcrDetails && (
                      <div className={`p-4 rounded-lg border text-left my-4 flex items-center justify-between transition-all duration-300 ${
                        isDocumentVerified 
                          ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-500" 
                          : "bg-rose-500/10 border-rose-500/30 text-rose-500"
                      }`}>
                        <div className="flex items-center gap-2.5">
                          {isDocumentVerified ? (
                            <CheckCircle className="h-5 w-5 text-emerald-500 animate-bounce" />
                          ) : (
                            <ShieldAlert className="h-5 w-5 text-rose-500" />
                          )}
                          <div>
                            <p className="text-xs font-bold uppercase tracking-wider">Aadhaar Location Verification</p>
                            <p className="text-[10px] text-muted-foreground mt-0.5">
                              {isDocumentVerified 
                                ? "Address extracted from Aadhaar Card aligns with your location." 
                                : "Address extracted from Aadhaar Card does not match your location."
                              }
                            </p>
                            {!isDocumentVerified && aadhaarDocAddress && (
                              <div className="mt-2 space-y-2">
                                <p className="text-[9px] font-mono p-2 bg-background/50 border border-rose-500/10 rounded text-rose-500/90 max-w-sm leading-normal break-words">
                                  <strong>Extracted Address:</strong> {aadhaarDocAddress}
                                </p>
                                <Button
                                  type="button"
                                  onClick={() => {
                                    setAadhaarDocAddress("Bypassed - Test Mode")
                                    setIsDocumentVerified(true)
                                    toast.success("GPS Location Match Bypassed for Testing!")
                                  }}
                                  className="w-full text-[10px] h-7 bg-amber-600/20 hover:bg-amber-600/30 text-amber-500 border border-amber-500/20 font-semibold flex items-center justify-center gap-1 cursor-pointer rounded"
                                >
                                  Bypass GPS Check (Test Mode)
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>
                        <span className={`px-2 py-0.5 rounded text-[9px] font-extrabold uppercase tracking-wide ${
                          isDocumentVerified ? "bg-emerald-500/20 text-emerald-500" : "bg-rose-500/20 text-rose-500"
                        }`}>
                          {isDocumentVerified ? "MATCHED" : "MISMATCHED"}
                        </span>
                      </div>
                    )}



                    {isDocumentVerified ? (
                      <motion.div
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="space-y-4 border-t border-border/40 pt-4"
                      >
                        <div className="flex items-center gap-1.5 pb-1">
                          <ShieldCheck className="h-4.5 w-4.5 text-emerald-500" />
                          <p className="text-xs font-bold text-emerald-500 uppercase tracking-wider">
                            Document Address Matched GPS Location. Please fill the details:
                          </p>
                        </div>

                        {/* Full Name */}
                        <div className="space-y-1.5 text-left">
                          <label className="text-xs font-medium text-foreground flex items-center gap-1.5">
                            <User className="h-3.5 w-3.5 text-rose-600 dark:text-rose-500" />
                            Full Name (as on official records)
                          </label>
                          <Input
                            type="text"
                            required
                            value={nameInput}
                            onChange={(e) => setNameInput(e.target.value)}
                            placeholder="e.g. Aarav Sharma"
                            className="bg-background border-border text-foreground text-sm h-10"
                          />
                        </div>

                        {/* Date of Birth */}
                        <div className="space-y-1.5 text-left">
                          <label className="text-xs font-medium text-foreground flex items-center gap-1.5">
                            <Calendar className="h-3.5 w-3.5 text-rose-600 dark:text-rose-500" />
                            Date of Birth
                          </label>
                          <Input
                            type="date"
                            required
                            value={dobInput}
                            onChange={(e) => setDobInput(e.target.value)}
                            className="bg-background border-border text-foreground text-sm h-10"
                          />
                        </div>
                        
                        {/* Aadhaar Number */}
                        <div className="space-y-1.5 text-left">
                          <label className="text-xs font-medium text-foreground flex items-center gap-1.5">
                            <Fingerprint className="h-3.5 w-3.5 text-rose-700 dark:text-rose-500" />
                            Aadhaar Number
                          </label>
                          <Input
                            type="text"
                            required
                            value={aadhaarInput}
                            onChange={handleAadhaarChange}
                            placeholder="XXXX XXXX XXXX"
                            className={`bg-background border-border text-foreground font-mono text-sm tracking-wider h-10 ${
                              isValidAadhaarNum ? "border-emerald-500/70 focus:border-emerald-500" : ""
                            }`}
                          />
                          {showAadhaarError && (
                            <p className="text-[10px] text-rose-500 flex items-center gap-1 mt-1">
                              <Info className="h-3 w-3" /> Invalid Aadhaar checksum. Please re-enter.
                            </p>
                          )}
                          {!showAadhaarError && !isValidAadhaarNum && (
                            <p className="text-[10px] text-muted-foreground mt-1">Enter your 12-digit Aadhaar number as printed on the card.</p>
                          )}
                        </div>

                        {/* Mobile Number */}
                        <div className="space-y-1.5 text-left">
                          <label className="text-xs font-medium text-foreground flex items-center gap-1.5">
                            <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                            Registered Mobile Number
                          </label>
                          <div className="flex">
                            <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-border bg-muted text-muted-foreground text-xs font-semibold select-none">
                              +91
                            </span>
                            <Input
                              type="text"
                              required
                              value={phoneInput}
                              onChange={(e) => setPhoneInput(e.target.value.replace(/\D/g, "").slice(0, 10))}
                              placeholder="10-digit mobile number"
                              className="bg-background border-border text-foreground text-sm rounded-none rounded-r-md h-10"
                            />
                          </div>
                          <p className="text-[10px] text-muted-foreground">Must be linked to your identity records.</p>
                        </div>

                        {/* PAN Number (Removed as PAN is no longer required) */}

                        {/* Residential Address Details */}
                        <div className="space-y-3 text-left border-t border-border/40 pt-4">
                          <div className="flex items-center justify-between">
                            <label className="text-xs font-medium text-foreground flex items-center gap-1.5">
                              <MapPin className="h-3.5 w-3.5 text-rose-600 dark:text-rose-500" />
                              Residential Address Details
                            </label>
                            <Button 
                              type="button" 
                              variant="outline" 
                              size="sm" 
                              onClick={autoDetectLocation}
                              disabled={detectingLoc}
                              className="text-[10px] h-7 border-rose-800/30 text-rose-500 hover:bg-rose-500/10 flex items-center gap-1 cursor-pointer"
                            >
                              {detectingLoc ? <RefreshCw className="h-3 w-3 animate-spin" /> : <MapPin className="h-3 w-3" />}
                              Re-verify Coordinates
                            </Button>
                          </div>

                          <div className="space-y-1">
                            <p className="text-[10px] font-medium text-muted-foreground">Flat / House No. &amp; Building Name</p>
                            <Input
                              id="flat-no-input"
                              type="text"
                              required
                              value={addrFlatNo}
                              onChange={(e) => setAddrFlatNo(e.target.value)}
                              placeholder="e.g. Flat 4B, Palm Grove Apartments"
                              className="bg-background border-border text-foreground text-sm h-10"
                            />
                          </div>

                          <div className="space-y-1">
                            <p className="text-[10px] font-medium text-muted-foreground">Street / Locality / Area</p>
                            <Input
                              type="text"
                              required
                              value={addrStreet}
                              onChange={(e) => setAddrStreet(e.target.value)}
                              placeholder="e.g. 12, MG Road, Salt Lake Sector V"
                              className="bg-background border-border text-foreground text-sm h-10"
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <p className="text-[10px] font-medium text-muted-foreground">City / District</p>
                              <div className="relative">
                                <Input
                                  type="text"
                                  required
                                  value={addrCity}
                                  onChange={(e) => handleCityInputChange(e.target.value)}
                                  onFocus={() => citySuggestions.length > 0 && setShowCitySuggestions(true)}
                                  onBlur={() => setTimeout(() => setShowCitySuggestions(false), 180)}
                                  placeholder="e.g. Kolkata"
                                  className="bg-background border-border text-foreground text-sm h-10 pr-8"
                                  autoComplete="off"
                                />
                                {cityLoading ? (
                                  <RefreshCw className="absolute right-2.5 top-3 h-3.5 w-3.5 animate-spin text-muted-foreground" />
                                ) : addrCity ? (
                                  <button type="button" onClick={() => { setAddrCity(""); setCitySuggestions([]) }} className="absolute right-2.5 top-3 text-muted-foreground hover:text-foreground">
                                    <X className="h-3.5 w-3.5" />
                                  </button>
                                ) : (
                                  <MapPin className="absolute right-2.5 top-3 h-3.5 w-3.5 text-muted-foreground" />
                                )}

                                {showCitySuggestions && citySuggestions.length > 0 && (
                                  <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-card border border-border rounded-lg shadow-2xl overflow-hidden max-h-52 overflow-y-auto">
                                    {citySuggestions.map((item: any, idx) => {
                                      const mainText = item.structured_formatting?.main_text || item.description
                                      const secondaryText = item.structured_formatting?.secondary_text || ""
                                      return (
                                        <button
                                          key={idx}
                                          type="button"
                                          onMouseDown={() => selectCitySuggestion(item)}
                                          className="w-full text-left px-3 py-2 hover:bg-muted/60 border-b border-border/50 last:border-0 transition"
                                        >
                                          <div className="flex items-center gap-2">
                                            <MapPin className="h-3 w-3 text-amber-500 flex-shrink-0" />
                                            <div>
                                              <p className="text-[11px] font-semibold text-foreground leading-tight">{mainText}</p>
                                              {secondaryText && <p className="text-[9px] text-muted-foreground">{secondaryText}</p>}
                                            </div>
                                          </div>
                                        </button>
                                      )
                                    })}
                                  </div>
                                )}
                              </div>
                            </div>

                            <div className="space-y-1">
                              <p className="text-[10px] font-medium text-muted-foreground">PIN Code</p>
                              <Input
                                type="text"
                                required
                                value={addrPin}
                                onChange={(e) => setAddrPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                                placeholder="e.g. 700091"
                                maxLength={6}
                                className={`bg-background border-border text-foreground text-sm h-10 font-mono tracking-widest ${
                                  addrPin.length === 6 && /^[1-9][0-9]{5}$/.test(addrPin)
                                    ? "border-emerald-500/70"
                                    : addrPin.length > 0
                                      ? "border-rose-400/70"
                                      : ""
                                }`}
                              />
                            </div>
                          </div>

                          <div className="space-y-1">
                            <p className="text-[10px] font-medium text-muted-foreground">State</p>
                            <select
                              required
                              value={addrState}
                              onChange={(e) => setAddrState(e.target.value)}
                              className="w-full h-10 rounded-md border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-rose-700 dark:focus:ring-rose-500 cursor-pointer"
                            >
                              <option value="">Select state...</option>
                              {[
                                "Andhra Pradesh","Arunachal Pradesh","Assam","Bihar","Chhattisgarh",
                                "Goa","Gujarat","Haryana","Himachal Pradesh","Jharkhand","Karnataka",
                                "Kerala","Madhya Pradesh","Maharashtra","Manipur","Meghalaya","Mizoram",
                                "Nagaland","Odisha","Punjab","Rajasthan","Sikkim","Tamil Nadu",
                                "Telangana","Tripura","Uttar Pradesh","Uttarakhand","West Bengal",
                                "Andaman and Nicobar Islands","Chandigarh","Dadra and Nagar Haveli and Daman and Diu",
                                "Delhi","Jammu and Kashmir","Ladakh","Lakshadweep","Puducherry"
                              ].map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                          </div>

                          <div className="flex items-start gap-1.5 pt-0.5 text-[10px] text-muted-foreground">
                            <Lock className="h-3 w-3 mt-0.5 flex-shrink-0 text-muted-foreground/60" />
                            <span>Your city will be cross-validated against your registered address details and current GPS location.</span>
                          </div>

                          {/* Address Matching Progress/Alerts */}
                          {isAddressMatching && (
                            <div className="p-4 bg-muted/30 border border-dashed border-rose-900/40 rounded-lg flex flex-col items-center justify-center gap-2 py-6 my-4 animate-in fade-in duration-300">
                              <RefreshCw className="h-6 w-6 text-rose-700 dark:text-rose-500 animate-spin" />
                              <p className="text-xs font-semibold text-foreground">Matching Entered Address against Aadhaar...</p>
                              <p className="text-[10px] text-muted-foreground font-mono">Running semantic comparison via Gemini AI.</p>
                            </div>
                          )}

                          {addressMatchError && (
                            <div className="p-4 rounded-lg border text-left my-4 bg-rose-500/10 border-rose-500/30 text-rose-500 space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
                              <div className="flex items-start gap-2.5">
                                <ShieldAlert className="h-5 w-5 text-rose-500 mt-0.5 flex-shrink-0 animate-bounce" />
                                <div>
                                  <p className="text-xs font-bold uppercase tracking-wider">Security Flag: Address Mismatch</p>
                                  <p className="text-[10px] text-muted-foreground mt-0.5 leading-normal">
                                    The residential address details you entered do not match the address read from your Aadhaar card.
                                  </p>
                                  <div className="mt-3 p-3.5 bg-background/50 border border-rose-500/10 rounded-lg space-y-2 text-[10px] font-mono leading-relaxed">
                                    <div>
                                      <span className="font-bold text-muted-foreground">Extracted Aadhaar Address:</span>
                                      <p className="text-rose-500/90 mt-0.5 font-sans leading-normal break-words">{aadhaarDocAddress}</p>
                                    </div>
                                    <div className="pt-2 border-t border-rose-500/10">
                                      <span className="font-bold text-muted-foreground">User Typed Address:</span>
                                      <p className="text-foreground/90 mt-0.5 font-sans leading-normal break-words">{typedAddress}</p>
                                    </div>
                                    <div className="pt-2 border-t border-rose-500/10">
                                      <span className="font-bold text-muted-foreground">Reason:</span>
                                      <p className="text-rose-400 font-sans leading-normal break-words">{addressMatchError}</p>
                                    </div>
                                  </div>
                                </div>
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                                <Button
                                  type="button"
                                  onClick={() => {
                                    setAddressMatchBypassed(true)
                                    setAddressMatchError(null)
                                    toast.success("Address match bypassed for testing!")
                                    const cleanAadhaar = aadhaarInput.replace(/\s+/g, "")
                                    submitVerificationData(cleanAadhaar, existingLocation)
                                  }}
                                  className="text-[10px] h-9 bg-amber-600/20 hover:bg-amber-600/30 text-amber-500 border border-amber-500/20 font-semibold flex items-center justify-center gap-1.5 cursor-pointer rounded-lg"
                                >
                                  <Lock className="h-3.5 w-3.5" />
                                  Bypass Address Check (Test Mode)
                                </Button>
                                <Button
                                  type="button"
                                  onClick={() => setAddressMatchError(null)}
                                  className="text-[10px] h-9 bg-muted hover:bg-muted/80 text-foreground font-semibold flex items-center justify-center gap-1.5 cursor-pointer rounded-lg border border-border"
                                >
                                  Go Back &amp; Edit
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    ) : (
                      <div className="p-6 bg-muted/40 border border-border rounded-lg text-center text-xs font-semibold text-muted-foreground flex flex-col items-center justify-center gap-2 py-8 my-4">
                        <Lock className="h-6 w-6 text-rose-700 dark:text-rose-500 animate-pulse animate-duration-1000" />
                        <p>Application Form Locked</p>
                        <p className="text-[10px] font-normal text-muted-foreground max-w-sm mt-1 leading-normal">
                          Please upload a screenshot of your Aadhaar card. Once your Aadhaar address is verified to align with your physical GPS location, the application form will unlock.
                        </p>
                      </div>
                    )}
                  </CardContent>

                  {isDocumentVerified && !addressMatchError && !isAddressMatching && (
                    <CardFooter className="pt-2">
                      <Button 
                        type="submit" 
                        className="w-full h-11 bg-[#8C002B] hover:bg-[#700022] text-white font-semibold transition-all duration-200 rounded-lg flex items-center justify-center gap-2 cursor-pointer shadow-sm border-none"
                        disabled={loading || !isFormValid()}
                      >
                        {locationLoading ? (
                          <>
                            <RefreshCw className="h-4 w-4 animate-spin" />
                            Validating location...
                          </>
                        ) : (
                          <>
                            Submit & Request Verification
                            <ArrowRight className="h-4 w-4" />
                          </>
                        )}
                      </Button>
                    </CardFooter>
                  )}
                </form>
              </Card>
            </motion.div>
          )}

          {/* STEP 2: RESULT (SUCCESS CARD / MISMATCH SECURITY ALERT) */}
          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.4 }}
              className="w-full flex flex-col items-center"
            >
              
              {verificationError ? (
                // LOCATION MISMATCH WARNING SCREEN
                <Card className="w-full max-w-lg bg-card/75 border-rose-500/30 backdrop-blur-xl shadow-2xl relative overflow-hidden text-center p-6 space-y-6">
                  <div className="absolute top-0 left-0 w-full h-[4px] bg-rose-600" />
                  
                  <div className="mx-auto w-16 h-16 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center animate-pulse">
                    <ShieldAlert className="h-8 w-8 text-rose-500" />
                  </div>

                  <div className="space-y-2">
                    <h2 className="text-xl font-bold text-rose-600 uppercase tracking-wide">Security Flag: Location Mismatch</h2>
                    <p className="text-sm text-foreground leading-relaxed max-w-md mx-auto">
                      {verificationError}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Physical coordinates do not align with your stated residential address. Verification rejected.
                    </p>
                  </div>

                  <div className="bg-muted/40 border border-border p-4 rounded-lg text-left space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="font-semibold text-muted-foreground">User Typed Address:</span>
                      <span className="font-mono text-foreground font-bold">{typedAddress}</span>
                    </div>
                    <div className="flex justify-between flex-wrap gap-1">
                      <span className="font-semibold text-muted-foreground">Detected GPS Location:</span>
                      <span className="font-mono text-rose-500 font-bold">{getDisplayLocation(existingLocation)}</span>
                    </div>
                  </div>

                  <div className="flex gap-4 max-w-xs mx-auto">
                    <Button onClick={handleReVerifyLocation} className="w-full bg-rose-600 hover:bg-rose-500 text-white font-semibold cursor-pointer border-none">
                      Re-Verify Location
                    </Button>
                  </div>
                </Card>
              ) : (
                // SUCCESS: GENERATED E-AADHAAR CARD
                demographics && (
                  <div className="flex flex-col items-center w-full max-w-lg">
                    <div className="text-center mb-6 space-y-2">
                      <div className="inline-flex p-3 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 mb-2">
                        <CheckCircle className="h-8 w-8 text-emerald-500" />
                      </div>
                      <h2 className="text-2xl font-bold text-foreground">Verification Succeeded!</h2>
                      <p className="text-muted-foreground text-sm max-w-sm">
                        Map coordinates matched residential coordinates. GPS secure card generated.
                      </p>
                    </div>

                    {/* CARD FLIP */}
                    <div className="relative w-full max-w-[480px] h-[300px] cursor-pointer group perspective-1000 mb-8" onClick={() => setIsFlipped(!isFlipped)}>
                      <motion.div 
                        className={`relative w-full h-full duration-500 transform-style-3d`}
                        animate={{ rotateY: isFlipped ? 180 : 0 }}
                        transition={{ duration: 0.6, ease: "easeInOut" }}
                      >
                        {/* CARD FRONT */}
                        <div className="absolute w-full h-full backface-hidden rounded-xl border border-amber-500/20 bg-gradient-to-tr from-red-950 via-rose-900 to-stone-950 text-white shadow-2xl p-6 flex flex-col justify-between select-none overflow-hidden">
                          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-amber-500/10 via-transparent to-transparent pointer-events-none" />
                          <div className="flex items-start justify-between relative z-10">
                            <div className="flex flex-col text-left">
                              <span className="font-bold text-base tracking-widest text-amber-400">GPS</span>
                              <span className="text-[7px] uppercase tracking-[0.2em] text-stone-400">Premium Secure System</span>
                            </div>
                            <div className="text-right flex flex-col items-end">
                              <span className="font-bold text-sm tracking-wider text-stone-200">IDFC FIRST</span>
                              <span className="text-[7px] uppercase tracking-wider text-amber-500 font-bold">{demographics.cardType || 'SELECT'}</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-4 relative z-10 my-auto">
                            {/* Gold Sim Chip */}
                            <div className="w-10 h-8 rounded bg-gradient-to-tr from-amber-300 via-yellow-400 to-amber-500 p-0.5 shadow-md flex flex-col justify-between flex-shrink-0">
                              <div className="flex justify-between h-2 border-b border-amber-600/35">
                                <div className="w-2 border-r border-amber-600/35"></div>
                                <div className="w-2 border-l border-amber-600/35"></div>
                              </div>
                              <div className="flex justify-between h-2 border-b border-amber-600/35">
                                <div className="w-2 border-r border-amber-600/35"></div>
                                <div className="w-2 border-l border-amber-600/35"></div>
                              </div>
                              <div className="flex justify-between h-2">
                                <div className="w-2 border-r border-amber-600/35"></div>
                                <div className="w-2 border-l border-amber-600/35"></div>
                              </div>
                            </div>
                            
                            {/* Alphanumeric Card Number */}
                            <div className="flex-1 text-left font-mono font-bold text-xl md:text-2xl tracking-widest text-amber-100/90 drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]">
                              {showFullAadhaar ? demographics.cardNumber : `XXXX XXXX ${demographics.cardNumber?.slice(-4)}`}
                            </div>
                            
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                setShowFullAadhaar(!showFullAadhaar)
                              }}
                              className="text-amber-500 hover:text-amber-400 p-1 flex-shrink-0"
                            >
                              {showFullAadhaar ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
                            </button>
                          </div>

                          <div className="flex justify-between items-end relative z-10 border-t border-amber-500/10 pt-3">
                            <div className="text-left">
                              <p className="text-[7px] uppercase tracking-wider text-stone-400 leading-none">Card Holder</p>
                              <p className="text-[11px] font-bold tracking-wider text-amber-100 uppercase mt-1">{demographics.name}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-[7px] uppercase tracking-wider text-stone-400 leading-none">Valid Thru</p>
                              <p className="text-[11px] font-mono font-bold tracking-wider text-amber-100 mt-1">{demographics.expiryDate || '12/30'}</p>
                            </div>
                          </div>
                        </div>

                        {/* CARD BACK */}
                        <div className="absolute w-full h-full backface-hidden rounded-xl border border-amber-500/20 bg-gradient-to-tr from-stone-950 via-rose-955 to-red-955 text-white shadow-2xl flex flex-col justify-between select-none rotate-y-180 overflow-hidden">
                          {/* Magnetic Stripe */}
                          <div className="w-full h-11 bg-stone-900 mt-4" />
                          
                          <div className="px-6 space-y-4">
                            <div className="flex items-center gap-3">
                              {/* Signature panel */}
                              <div className="flex-1 h-8 bg-stone-100 text-stone-850 text-left font-mono font-bold italic px-3 flex items-center text-xs rounded select-none pointer-events-none">
                                {demographics.name}
                              </div>
                              {/* CVV */}
                              <div className="w-12 h-8 bg-amber-400 text-stone-950 font-mono font-bold text-center flex items-center justify-center rounded shadow-inner">
                                {demographics.cvv || '***'}
                              </div>
                            </div>

                            <div className="text-left text-[8px] text-stone-400 leading-relaxed space-y-1">
                              <p className="font-bold text-amber-500/90 uppercase">GPS Verification network</p>
                              <p className="font-semibold text-stone-200">Address: {demographics.address}</p>
                              <p className="text-[7px]">This secure card certifies successful GPS identity verification and address audit mapping. Secured under IDFC credit policies.</p>
                            </div>
                          </div>

                          <div className="border-t border-amber-500/10 py-3 px-6 flex justify-between items-center text-[7px] text-stone-500 font-semibold bg-stone-950/60">
                            <span>GPS SECURE NETWORK</span>
                            <span className="text-amber-500">✓ AUDIT SIGNATURE VALID</span>
                          </div>
                        </div>
                      </motion.div>
                    </div>

                    <div className="flex gap-4 w-full max-w-xs relative z-10 font-bold">
                      <Button onClick={handleReset} variant="outline" className="flex-1 border-border text-foreground hover:bg-muted/50 cursor-pointer">
                        Verify Another
                      </Button>
                      <Button onClick={() => window.print()} className="flex-1 bg-[#8C002B] hover:bg-[#6b0021] text-white flex items-center justify-center gap-2 cursor-pointer border-none shadow-sm">
                        <Download className="h-4 w-4" />
                        Print Card
                      </Button>
                    </div>
                  </div>
                )
              )}
            </motion.div>
          )}

        </AnimatePresence>

        {/* OTP Modal Overlay */}
        {showOtpModal && (
          <div className="fixed inset-0 bg-background/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-card border border-border rounded-xl shadow-2xl p-6 w-full max-w-md text-center space-y-6"
            >
              <div className="space-y-1.5">
                <div className="mx-auto w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mb-2">
                  <Key className="h-6 w-6 text-rose-700 dark:text-rose-500" />
                </div>
                <h3 className="text-lg font-bold text-foreground">Enter Verification Code</h3>
                <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                  A 6-digit OTP code has been sent to +91 XXXXXXX{phoneInput.slice(-3)}.
                </p>
              </div>

              <form onSubmit={handleVerifyOtp} className="space-y-6">
                <div className="flex gap-2 justify-center">
                  {otpValues.map((digit, index) => (
                    <input
                      key={index}
                      ref={(el) => { otpRefs.current[index] = el; }}
                      type="text"
                      value={digit}
                      maxLength={1}
                      onChange={(e) => handleOtpChange(index, e.target.value)}
                      onKeyDown={(e) => handleKeyDown(index, e)}
                      className="w-10 h-12 text-center text-lg font-bold bg-background border border-border rounded-lg focus:border-[#8C002B] focus:outline-none focus:ring-1 focus:ring-[#8C002B] text-foreground font-mono transition-all"
                    />
                  ))}
                </div>

                <div className="text-center space-y-1">
                  {timer > 0 ? (
                    <p className="text-xs text-muted-foreground">
                      Resend code in <span className="font-mono font-semibold text-rose-700 dark:text-rose-500">{Math.floor(timer / 60)}:{(timer % 60).toString().padStart(2, "0")}</span>
                    </p>
                  ) : (
                    <Button
                      type="button"
                      variant="link"
                      onClick={handleResendOtp}
                      className="h-auto p-0 text-xs text-rose-700 hover:text-rose-600 dark:text-rose-500 dark:hover:text-rose-400 font-semibold flex items-center gap-1.5 cursor-pointer"
                      disabled={loading}
                    >
                      <RefreshCw className="h-3 w-3" />
                      Resend OTP Code
                    </Button>
                  )}
                </div>

                <div className="flex gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowOtpModal(false)}
                    className="flex-1 cursor-pointer"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1 bg-[#8C002B] hover:bg-[#700022] text-white font-semibold cursor-pointer border-none"
                    disabled={loading || otpValues.some(v => v === "")}
                  >
                    {loading ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      "Confirm & Verify"
                    )}
                  </Button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-background/50 py-6 text-center text-xs text-muted-foreground mt-auto transition-colors">
        <div className="max-w-4xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>© 2026 GPS Secure Card Portal. All rights reserved.</p>
          <div className="flex gap-4 font-medium">
            <span className="hover:text-foreground cursor-pointer transition">Terms</span>
            <span className="hover:text-foreground cursor-pointer transition">Privacy Policy</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
