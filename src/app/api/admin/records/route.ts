import { NextResponse } from 'next/server';
import { getRecords, deleteRecord, clearAllRecords } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = (searchParams.get('search') || '').toLowerCase().trim();
    const status = searchParams.get('status') || 'ALL';

    const allRecords = getRecords();

    // Calculate overall statistics
    const total = allRecords.length;
    const verified = allRecords.filter(r => r.status === 'VERIFIED').length;
    const pending = allRecords.filter(r => r.status === 'PENDING').length;
    const failed = allRecords.filter(r => r.status === 'FAILED').length;
    
    const successRate = total > 0 ? Math.round((verified / total) * 100) : 0;

    // Generate timeline chart data for the past 7 days
    const chartDataMap: { [date: string]: { date: string; verified: number; pending: number } } = {};
    
    // Initialize past 7 days
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      chartDataMap[dateStr] = { date: dateStr, verified: 0, pending: 0 };
    }

    allRecords.forEach(r => {
      const dateStr = new Date(r.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      if (chartDataMap[dateStr]) {
        if (r.status === 'VERIFIED') chartDataMap[dateStr].verified++;
        else if (r.status === 'PENDING') chartDataMap[dateStr].pending++;
      }
    });

    const timelineData = Object.values(chartDataMap);

    // Apply filtering on records returned to the table
    let filteredRecords = allRecords;

    if (status !== 'ALL') {
      filteredRecords = filteredRecords.filter(r => r.status === status);
    }

    if (search) {
      filteredRecords = filteredRecords.filter(r => {
        const aadhaarMatch = r.aadhaarNumber.includes(search);
        const phoneMatch = r.phoneNumber.includes(search);
        const nameMatch = r.demographics?.name?.toLowerCase().includes(search) || false;
        const fatherMatch = r.demographics?.fatherName?.toLowerCase().includes(search) || false;
        const addressMatch = r.demographics?.address?.toLowerCase().includes(search) || false;
        const panMatch = r.panNumber?.toLowerCase().includes(search);
        const emailMatch = r.email?.toLowerCase().includes(search);
        
        return aadhaarMatch || phoneMatch || nameMatch || fatherMatch || addressMatch || panMatch || emailMatch;
      });
    }

    return NextResponse.json({
      success: true,
      records: filteredRecords,
      stats: {
        total,
        verified,
        pending,
        failed,
        successRate,
        timelineData
      }
    });

  } catch (error) {
    console.error('Error in admin records API:', error);
    return NextResponse.json(
      { success: false, message: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const action = searchParams.get('action');

    if (action === 'clear') {
      clearAllRecords();
      return NextResponse.json({ success: true, message: 'All records cleared successfully' });
    }

    if (!id) {
      return NextResponse.json(
        { success: false, message: 'Record ID is required' },
        { status: 400 }
      );
    }

    const deleted = deleteRecord(id);
    if (!deleted) {
      return NextResponse.json(
        { success: false, message: 'Record not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, message: 'Record deleted successfully' });

  } catch (error) {
    console.error('Error in delete record API:', error);
    return NextResponse.json(
      { success: false, message: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
