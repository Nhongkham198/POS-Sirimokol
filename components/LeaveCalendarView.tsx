
import React, { useState, useMemo } from 'react';
import type { LeaveRequest, User, Branch } from '../types';
import Swal from 'sweetalert2';
import { DailyLeaveDetailsModal } from './DailyLeaveDetailsModal';

// Use declare var to avoid import issues if using CDN, 
// or you could import it if you have the package installed
declare var XLSX: any;

interface LeaveCalendarViewProps {
    leaveRequests: LeaveRequest[];
    currentUser: User | null;
    onOpenRequestModal: (date?: Date) => void;
    branches?: Branch[];
    onUpdateStatus?: (requestId: number, status: 'approved' | 'rejected') => void;
    onDeleteRequest?: (requestId: number) => Promise<boolean>;
    selectedBranch?: Branch | null;
}

export const LeaveCalendarView: React.FC<LeaveCalendarViewProps> = ({ leaveRequests, currentUser, onOpenRequestModal, branches, onUpdateStatus, onDeleteRequest, selectedBranch }) => {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
    const [selectedDayDetails, setSelectedDayDetails] = useState<{ date: Date, leaves: LeaveRequest[] } | null>(null);

    const daysInMonth = useMemo(() => {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const days = new Date(year, month + 1, 0).getDate();
        return Array.from({ length: days }, (_, i) => i + 1);
    }, [currentDate]);

    const firstDayOfMonth = useMemo(() => {
        return new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();
    }, [currentDate]);

    const handlePrevMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    };

    const handleNextMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    };

    // --- Filtering Logic ---
    const visibleRequests = useMemo(() => {
        if (!currentUser) return [];

        // Admin sees all requests.
        if (currentUser.role === 'admin') {
            return leaveRequests;
        }

        // Branch Admin and Auditors see requests for their assigned branches.
        if (currentUser.role === 'branch-admin' || currentUser.role === 'auditor') {
            return leaveRequests.filter(req => currentUser.allowedBranchIds?.includes(req.branchId));
        }

        // Staff (POS/Kitchen) see all requests for the currently selected branch.
        if (selectedBranch) {
            return leaveRequests.filter(req => req.branchId === selectedBranch.id);
        }

        // Fallback for staff if no branch is selected (should not happen in normal flow)
        return leaveRequests.filter(req => req.userId === currentUser.id);

    }, [leaveRequests, currentUser, selectedBranch]);

    const getLeavesForDay = (day: number) => {
        const currentYear = currentDate.getFullYear();
        const currentMonth = currentDate.getMonth();
        
        const startOfDay = new Date(currentYear, currentMonth, day, 0, 0, 0).getTime();
        const endOfDay = new Date(currentYear, currentMonth, day, 23, 59, 59).getTime();

        return visibleRequests.filter(request => {
            return request.startDate <= endOfDay && request.endDate >= startOfDay;
        });
    };
    
    const handleDayClick = (day: number) => {
        const leavesOnDay = getLeavesForDay(day);
        const clickedDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
        if (leavesOnDay.length > 0) {
            setSelectedDayDetails({ date: clickedDate, leaves: leavesOnDay });
            setIsDetailsModalOpen(true);
        } else {
            onOpenRequestModal(clickedDate);
        }
    };

    const monthNames = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];

    const getBranchName = (branchId: number) => {
        return branches?.find(b => b.id === branchId)?.name || `สาขา #${branchId}`;
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'approved': return <span className="px-2 py-1 rounded-full bg-green-100 text-green-800 text-xs font-bold">อนุมัติแล้ว</span>;
            case 'rejected': return <span className="px-2 py-1 rounded-full bg-red-100 text-red-800 text-xs font-bold">ไม่อนุมัติ</span>;
            default: return <span className="px-2 py-1 rounded-full bg-yellow-100 text-yellow-800 text-xs font-bold">รออนุมัติ</span>;
        }
    };

    const getTypeLabel = (type: string) => {
        switch (type) {
            case 'sick': return 'ลาป่วย';
            case 'personal': return 'ลากิจ';
            case 'vacation': return 'ลาไม่รับเงินเดือน';
            case 'leave-without-pay': return 'ลาไม่รับเงินเดือน';
            default: return 'อื่นๆ';
        }
    };

    // Check if current user can approve a specific request
    const canApproveRequest = (req: LeaveRequest) => {
        if (!currentUser) return false;
        
        // Admins can approve any request.
        if (currentUser.role === 'admin') {
            return true;
        }

        // Branch Admins and Auditors can approve requests for their allowed branches.
        if ((currentUser.role === 'branch-admin' || currentUser.role === 'auditor') && currentUser.allowedBranchIds?.includes(req.branchId)) {
            return true;
        }
        
        return false;
    };

    const handleExportLeaves = () => {
        if (visibleRequests.length === 0) {
            Swal.fire('ไม่มีข้อมูล', 'ไม่พบรายการวันลาเพื่อส่งออก', 'info');
            return;
        }

        const data = visibleRequests.map(req => ({
            'วันที่ยื่น': req.submittedAt ? new Date(req.submittedAt).toLocaleDateString('th-TH') : '-',
            'พนักงาน': req.username,
            'สาขา': getBranchName(req.branchId),
            'ประเภท': getTypeLabel(req.type),
            'วันที่เริ่มลา': new Date(req.startDate).toLocaleDateString('th-TH'),
            'ถึงวันที่': new Date(req.endDate).toLocaleDateString('th-TH'),
            'เหตุผล': req.reason,
            'สถานะ': req.status === 'approved' ? 'อนุมัติแล้ว' : req.status === 'rejected' ? 'ไม่อนุมัติ' : 'รออนุมัติ'
        }));

        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "LeaveHistory");
        
        const fileName = `Leave_History_${new Date().toISOString().slice(0, 10)}.xlsx`;
        XLSX.writeFile(wb, fileName);
    };

    const handleDeleteClick = async (requestId: number) => {
        const result = await Swal.fire({
            title: 'ยืนยันการลบ?',
            text: "คุณต้องการลบประวัติการลานี้ใช่หรือไม่? (ไม่สามารถกู้คืนได้)",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'ใช่, ลบเลย',
            cancelButtonText: 'ยกเลิก'
        });

        if (result.isConfirmed && onDeleteRequest) {
            const success = await onDeleteRequest(requestId);
            if (success) {
                Swal.fire(
                    'ลบเรียบร้อย!',
                    'ประวัติการลาถูกลบแล้ว',
                    'success'
                );
            }
        }
    };

    return (
        <>
            <div className="flex flex-col h-full w-full bg-gray-50 p-4 overflow-y-auto pb-24">
                <div className="flex justify-between items-center mb-4 flex-shrink-0">
                    <h2 className="text-2xl font-bold text-gray-800">
                        ปฏิทินวันลา - {monthNames[currentDate.getMonth()]} {currentDate.getFullYear() + 543}
                    </h2>
                    <div className="flex gap-4">
                        <div className="flex bg-white rounded-lg shadow-sm border border-gray-200">
                            <button onClick={handlePrevMonth} className="px-4 py-2 hover:bg-gray-100 text-gray-600 border-r">
                                &lt;
                            </button>
                            <button onClick={() => setCurrentDate(new Date())} className="px-4 py-2 hover:bg-gray-100 text-gray-600 border-r font-semibold">
                                วันนี้
                            </button>
                            <button onClick={handleNextMonth} className="px-4 py-2 hover:bg-gray-100 text-gray-600">
                                &gt;
                            </button>
                        </div>
                        {(currentUser?.role === 'admin' || currentUser?.role === 'branch-admin') && (
                            <button 
                                onClick={handleExportLeaves}
                                className="px-4 py-2 bg-green-600 text-white font-semibold rounded-lg shadow hover:bg-green-700 transition-colors flex items-center gap-2"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
                                </svg>
                                ส่งออก Excel
                            </button>
                        )}
                        <button 
                            onClick={() => onOpenRequestModal()}
                            className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg shadow hover:bg-blue-700 transition-colors flex items-center gap-2"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                            </svg>
                            ขอวันลา
                        </button>
                    </div>
                </div>

                {/* Calendar Grid */}
                <div className="bg-white rounded-xl shadow-lg border border-gray-200 flex flex-col overflow-hidden w-full mb-6" style={{ minHeight: '500px' }}>
                    <div className="grid grid-cols-7 bg-gray-100 border-b border-gray-200 text-center py-3 font-semibold text-gray-600 flex-shrink-0">
                        <div className="text-red-500">อาทิตย์</div>
                        <div>จันทร์</div>
                        <div>อังคาร</div>
                        <div>พุธ</div>
                        <div>พฤหัสบดี</div>
                        <div>ศุกร์</div>
                        <div>เสาร์</div>
                    </div>

                    <div className="grid grid-cols-7 auto-rows-fr flex-1 h-full w-full">
                        {Array.from({ length: firstDayOfMonth }).map((_, i) => (
                            <div key={`empty-${i}`} className="bg-gray-50 border-b border-r border-gray-100"></div>
                        ))}

                        {daysInMonth.map(day => {
                            const leaves = getLeavesForDay(day);
                            const isToday = new Date().getDate() === day && new Date().getMonth() === currentDate.getMonth() && new Date().getFullYear() === currentDate.getFullYear();

                            return (
                                <div 
                                    key={day} 
                                    onClick={() => handleDayClick(day)}
                                    className={`border-b border-r border-gray-100 p-2 relative flex flex-col min-h-[100px] cursor-pointer hover:bg-blue-50 transition-colors ${isToday ? 'bg-blue-50' : ''}`}
                                >
                                    <div className="flex-shrink-0 mb-1">
                                        <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-sm font-medium ${isToday ? 'bg-blue-600 text-white' : 'text-gray-700'}`}>
                                            {day}
                                        </span>
                                    </div>
                                    <div className="flex-1 overflow-y-auto space-y-1 custom-scrollbar">
                                        {leaves.map(leave => (
                                            <div 
                                                key={leave.id}
                                                onClick={(e) => e.stopPropagation()} // Prevent triggering day click when clicking a badge
                                                className={`text-xs px-2 py-1 rounded truncate cursor-help border ${
                                                    leave.status === 'pending' ? 'bg-yellow-100 text-yellow-800 border-yellow-200' :
                                                    leave.status === 'approved' ? 'bg-green-100 text-green-800 border-green-200' :
                                                    'bg-red-100 text-red-800 border-red-200 line-through opacity-60'
                                                }`}
                                                title={`${leave.username} (${getBranchName(leave.branchId)}): ${leave.reason} [${getTypeLabel(leave.type)}]`}
                                            >
                                                {leave.username}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                        
                        {Array.from({ length: (7 - (firstDayOfMonth + daysInMonth.length) % 7) % 7 }).map((_, i) => (
                             <div key={`empty-end-${i}`} className="bg-gray-50 border-b border-r border-gray-100"></div>
                        ))}
                    </div>
                </div>

                {/* Leave History List & Approval Section */}
                <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6 w-full">
                    <h3 className="text-xl font-bold text-gray-800 mb-4 border-b pb-2">ประวัติการลา & การอนุมัติ</h3>
                    
                    {visibleRequests.length === 0 ? (
                        <p className="text-gray-500 text-center py-4">ไม่มีข้อมูลการลา</p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="text-gray-600 border-b">
                                        <th className="py-2 px-4">วันที่ยื่น</th>
                                        <th className="py-2 px-4">พนักงาน</th>
                                        <th className="py-2 px-4">สาขา</th>
                                        <th className="py-2 px-4">ประเภท</th>
                                        <th className="py-2 px-4">วันที่ลา</th>
                                        <th className="py-2 px-4">เหตุผล</th>
                                        <th className="py-2 px-4">สถานะ</th>
                                        <th className="py-2 px-4 text-right">จัดการ</th>
                                    </tr>
                                </thead>
                                <tbody className="text-sm text-gray-800">
                                    {[...visibleRequests].sort((a, b) => b.id - a.id).map(req => (
                                        <tr key={req.id} className="border-b hover:bg-gray-50">
                                            <td className="py-3 px-4 text-gray-500">
                                                {/* FIX: Use submittedAt if available, otherwise show placeholder to avoid 2513 date */}
                                                {req.submittedAt ? new Date(req.submittedAt).toLocaleDateString('th-TH') : '-'}
                                            </td>
                                            <td className="py-3 px-4 font-medium">{req.username}</td>
                                            <td className="py-3 px-4 text-gray-600">{getBranchName(req.branchId)}</td>
                                            <td className="py-3 px-4">{getTypeLabel(req.type)}</td>
                                            <td className="py-3 px-4">
                                                {new Date(req.startDate).toLocaleDateString('th-TH')} - {new Date(req.endDate).toLocaleDateString('th-TH')}
                                            </td>
                                            <td className="py-3 px-4 text-gray-600 max-w-xs truncate" title={req.reason}>{req.reason}</td>
                                            <td className="py-3 px-4">{getStatusBadge(req.status)}</td>
                                            <td className="py-3 px-4 text-right">
                                                <div className="flex justify-end gap-2 items-center">
                                                    {/* Approval Buttons - Only show if authorized and pending */}
                                                    {req.status === 'pending' && canApproveRequest(req) && onUpdateStatus && (
                                                        <>
                                                            <button 
                                                                onClick={() => onUpdateStatus(req.id, 'approved')}
                                                                className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600 text-xs font-bold shadow-sm"
                                                            >
                                                                อนุมัติ
                                                            </button>
                                                            <button 
                                                                onClick={() => onUpdateStatus(req.id, 'rejected')}
                                                                className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 text-xs font-bold shadow-sm"
                                                            >
                                                                ไม่อนุมัติ
                                                            </button>
                                                        </>
                                                    )}
                                                    {/* Delete Button - Admin Only */}
                                                    {currentUser?.role === 'admin' && (
                                                        <button 
                                                            onClick={() => handleDeleteClick(req.id)}
                                                            className="p-1.5 text-red-500 hover:bg-red-100 rounded-full transition-colors"
                                                            title="ลบประวัติการลา (Admin Only)"
                                                        >
                                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                                                <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm4 0a1 1 0 012 0v6a1 1 0 11-2 0V8z" clipRule="evenodd" />
                                                            </svg>
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
            <DailyLeaveDetailsModal
                isOpen={isDetailsModalOpen}
                onClose={() => setIsDetailsModalOpen(false)}
                date={selectedDayDetails?.date || null}
                leaves={selectedDayDetails?.leaves || []}
                onAddNew={() => {
                    setIsDetailsModalOpen(false);
                    onOpenRequestModal(selectedDayDetails?.date);
                }}
            />
        </>
    );
};
