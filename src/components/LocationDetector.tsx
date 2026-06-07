"use client"

import React, { useEffect, useRef } from "react"
import { MapPin } from "lucide-react"
import { toast } from "sonner"

interface LocationDetectorProps {
  existingLocation: string
  setExistingLocation: (loc: string) => void
  locationError: string
  setLocationError: (err: string) => void
  detectingLoc: boolean
  setDetectingLoc: (val: boolean) => void
  locationDetectingBg: boolean
  setLocationDetectingBg: (val: boolean) => void
  
  // Form values/setters
  addrCity: string
  addrState: string
  addrPin: string
  setAddrFlatNo: (v: string) => void
  setAddrStreet: (v: string) => void
  setAddrCity: (v: string) => void
  setAddrPin: (v: string) => void
  setAddrState: (v: string) => void

  // Manual refresh triggers
  refreshTrigger: number
}

export default function LocationDetector({
  existingLocation,
  setExistingLocation,
  locationError,
  setLocationError,
  detectingLoc,
  setDetectingLoc,
  locationDetectingBg,
  setLocationDetectingBg,
  addrCity,
  addrState,
  addrPin,
  setAddrFlatNo,
  setAddrStreet,
  setAddrCity,
  setAddrPin,
  setAddrState,
  refreshTrigger
}: LocationDetectorProps) {
  
  const isInitialMount = useRef(true)

  // 1. Reverse Geocoding with Ola Maps
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
        
        const candidateSet = new Set<string>()

        for (const comp of comps) {
          const types: string[] = comp.types || []
          const name: string = (comp.long_name || "").trim()

          if (types.some(t => ["premise","subpremise","street_number","house_number","building"].includes(t))) {
            houseNumber = name
          } else if (types.includes("route")) {
            road = name
          } else if (types.some(t => t.startsWith("sublocality"))) {
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

          const skipTypes = ["country", "postal_code", "premise", "subpremise", "street_number", "house_number", "building", "route"]
          if (!types.some(t => skipTypes.includes(t)) && name && name.length > 2) {
            candidateSet.add(name)
          }
        }

        if (!city) {
          const districtComp = comps.find((c: any) =>
            c.types.includes("administrative_area_level_2") || c.types.includes("administrative_area_level_3")
          )
          if (districtComp) city = districtComp.long_name
        }

        if (city && city !== "Unknown") candidateSet.add(city)

        const formattedAddr: string = result.formatted_address || ""
        if (formattedAddr) {
          formattedAddr.split(",").forEach((seg: string) => {
            const s = seg.trim()
            if (s && s.length > 2 && s.length < 60 && !/^\d+$/.test(s)) {
              candidateSet.add(s)
            }
          })
        }

        const candidates = Array.from(candidateSet)
        const streetInfo = [road, sublocality, neighborhood].filter(Boolean).join(", ")
        
        const shouldFill = fillFormFields || (!addrCity && !addrState && !addrPin)
        if (shouldFill) {
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

  // 2. IP Geocoding Fallback
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
        
        const shouldFill = fillFormFields || (!addrCity && !addrState && !addrPin)
        if (shouldFill) {
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

  // 3. Unified Location Detector — shared by watch & manual triggers
  const triggerLocationDetect = async (fillFormFields: boolean): Promise<any> => {
    setDetectingLoc(true)
    setLocationError("")

    const runIpFallback = async () => {
      const details = await performIpGeocoding(fillFormFields)
      if (details) {
        if (fillFormFields) toast.success("Location resolved via IP!", {
          description: `${details.city}, ${details.state}`
        })
      } else {
        toast.error("Location detection failed", {
          description: "Check internet connection or enter city manually."
        })
      }
      setDetectingLoc(false)
      return details
    }

    const isInsecureNetwork = typeof window !== "undefined" && !window.isSecureContext && window.location.hostname !== "localhost"

    if (isInsecureNetwork) {
      return runIpFallback()
    } else if (navigator.geolocation) {
      return new Promise((resolve) => {
        navigator.geolocation.getCurrentPosition(
          async (position) => {
            const details = await performGeocoding(position.coords.latitude, position.coords.longitude, fillFormFields)
            if (!details) {
              const fb = await runIpFallback()
              resolve(fb)
            } else {
              if (fillFormFields) toast.success("Coordinates resolved!", {
                description: `${details.city}, ${details.state}`
              })
              setDetectingLoc(false)
              resolve(details)
            }
          },
          async (error) => {
            console.warn("GPS failed, falling back to IP:", error.message)
            const fb = await runIpFallback()
            resolve(fb)
          },
          { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
        )
      })
    } else {
      return runIpFallback()
    }
  }

  // 4. Background GPS Watcher on Page Load
  useEffect(() => {
    let watchId: number | null = null
    const isInsecureNetwork = typeof window !== "undefined" && !window.isSecureContext && window.location.hostname !== "localhost"

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

  // 5. Watch for manual refresh triggers
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false
      return
    }
    if (refreshTrigger > 0) {
      triggerLocationDetect(true)
    }
  }, [refreshTrigger])

  // Helper to get formatted display name
  const getDisplayLocation = (locStr: string) => {
    if (!locStr) return "Unknown"
    try {
      const parsed = JSON.parse(locStr)
      return parsed.displayName || `${parsed.city}, ${parsed.state}`
    } catch {
      return locStr
    }
  }

  const isResolving = locationDetectingBg || detectingLoc

  return (
    <div className="p-3 bg-muted/40 border border-border rounded-lg flex items-center justify-between text-xs">
      <div className="flex items-center gap-2">
        <MapPin className="h-4 w-4 text-[#8C002B] animate-pulse" />
        <div>
          <p className="font-semibold text-foreground">Current GPS Location</p>
          <p className="text-[10px] text-muted-foreground">
            {isResolving 
              ? "Resolving coordinates..." 
              : existingLocation 
                ? getDisplayLocation(existingLocation) 
                : locationError || "Location failed"}
          </p>
        </div>
      </div>
      <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
        isResolving 
          ? "bg-amber-500/10 text-amber-500 animate-pulse" 
          : existingLocation 
            ? "bg-emerald-500/10 text-emerald-500" 
            : "bg-rose-500/10 text-rose-500"
      }`}>
        {isResolving ? "RESOLVING" : existingLocation ? "RESOLVED" : "FAILED"}
      </span>
    </div>
  )
}
