

import React, { useState, useMemo, useEffect } from 'react';
import type { LeaveRequest, User } from '../types';
import Swal from 'sweetalert2';

interface LeaveRequestModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentUser: User | null;
    // FIX: The onSave prop should not expect a branchId, as the parent component (App.tsx) is responsible for adding it based on the currently selected branch. The modal component doesn't have this information.
    onSave: (request: Omit<LeaveRequest, 'id' | 'status' | 'branchId'>) => void;
    leaveRequests?: LeaveRequest[]; // Needed to calculate remaining days
    initialDate?: Date | null;
}

export const LeaveRequestModal: React.FC<LeaveRequestModalProps> = ({ isOpen, onClose, currentUser, onSave, leaveRequests = [], initialDate }) => {
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [type, setType] = useState<LeaveRequest['type']>('personal');
    const [reason, setReason] = useState('');
    const [isHalfDay, setIsHalfDay] = useState(false);

    // Pre-fill date when initialDate changes or modal opens
    useEffect(() => {
        if (isOpen && initialDate) {
            const year = initialDate.getFullYear();
            const month = String(initialDate.getMonth() + 1).padStart(2, '0');
            const day = String(initialDate.getDate()).padStart(2, '0');
            const formattedDate = `${year}-${month}-${day}`;
            
            setStartDate(formattedDate);
            setEndDate(formattedDate); 
        } else if (isOpen && !initialDate) {
            setStartDate('');
            setEndDate('');
        }
        // Reset half day on open
        if(isOpen) setIsHalfDay(false);
    }, [isOpen, initialDate]);

    // Force endDate to be same as startDate if half-day is checked
    useEffect(() => {
        if (isHalfDay && startDate) {
            setEndDate(startDate);
        }
    }, [isHalfDay, startDate]);

    const duration = useMemo(() => {
        if (isHalfDay) {
            return 0.5;
        }
        if (!startDate || !endDate) {
            return 0;
        }
    
        try {
            const start = new Date(startDate);
            const end = new Date(endDate);
            
            start.setHours(0,0,0,0);
            end.setHours(23,59,59,999);
    
            if (end < start) {
                return 0;
            }
    
            const diffTime = end.getTime() - start.getTime();
            // Using Math.round to account for the almost-full-day difference from 00:00 to 23:59:59
            const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
            
            return diffDays > 0 ? diffDays : 1;
    
        } catch (e) {
            return 0;
        }
    }, [startDate, endDate, isHalfDay]);

    const quotas = useMemo(() => {
        const defaultQuotas = { sick: 30, personal: 6, vacation: 6 }; 
        if (!currentUser) return { total: defaultQuotas, used: { sick: 0, personal: 0, vacation: 0 } };

        const userQuotas = currentUser.leaveQuotas || defaultQuotas;

        // Calculate used days
        const used = { sick: 0, personal: 0, vacation: 0 };
        
        leaveRequests.forEach(req => {
            if (req.userId === currentUser.id && req.status === 'approved') { 
                let diffDays = 0;
                if (req.isHalfDay) {
                    diffDays = 0.5;
                } else {
                    // Consistent logic with duration calculation above
                    const diffTime = Math.abs(req.endDate - req.startDate);
                    diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
                    if (diffDays <= 0) diffDays = 1;
                }
                
                if (req.type === 'sick') used.sick += diffDays;
                else if (req.type === 'personal') used.personal += diffDays;
                else if (req.type === 'leave-without-pay') used.vacation += diffDays; 
            }
        });

        return { total: userQuotas, used };
    }, [currentUser, leaveRequests]);

    const remainingPersonal = Math.max(0, quotas.total.personal - quotas.used.personal);
    const remainingSick = Math.max(0, quotas.total.sick - quotas.used.sick);

    // Auto-switch type if current selection is invalid due to quota
    useEffect(() => {
        if (isOpen) {
            if (type === 'personal' && remainingPersonal <= 0) {
                setType('leave-without-pay');
            } else if (type === 'sick' && remainingSick <= 0) {
                setType('leave-without-pay');
            }
        }
    }, [isOpen, type, remainingPersonal, remainingSick]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentUser) return;
        
        if (!startDate || !endDate || !reason) {
            Swal.fire('ข้อมูลไม่ครบถ้วน', 'กรุณากรอกวันที่และเหตุผล', 'warning');
            return;
        }

        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);

        if (end < start) {
            Swal.fire('วันที่ไม่ถูกต้อง', 'วันสิ้นสุดต้องไม่ก่อนวันเริ่มต้น', 'error');
            return;
        }

        // Final validation for quota before submit (in case UI was bypassed)
        if (duration <= 0) {
            Swal.fire('วันที่ไม่ถูกต้อง', 'ระยะเวลาการลาไม่ถูกต้อง', 'error');
            return;
        }
        
        if (type === 'personal' && remainingPersonal < duration) {
             Swal.fire('สิทธิ์วันลาไม่พอ', `วันลากิจเหลือ ${remainingPersonal} วัน แต่คุณขอ ${duration} วัน ระบบจะเปลี่ยนเป็นลาไม่รับเงินเดือนแทนหรือไม่?`, 'question').then((result) => {
                 if(result.isConfirmed) setType('leave-without-pay');
             });
             return;
        }
        if (type === 'sick' && remainingSick < duration) {
             Swal.fire('สิทธิ์วันลาไม่พอ', `วันลาป่วยเหลือ ${remainingSick} วัน แต่คุณขอ ${duration} วัน ระบบจะเปลี่ยนเป็นลาไม่รับเงินเดือนแทนหรือไม่?`, 'question').then((result) => {
                 if(result.isConfirmed) setType('leave-without-pay');
             });
             return;
        }

        onSave({
            userId: currentUser.id,
            username: currentUser.username,
            startDate: start.getTime(),
            endDate: end.getTime(),
            type,
            reason,
            isHalfDay
        });
        
        // Reset form
        setStartDate('');
        setEndDate('');
        setReason('');
        setType('personal');
        setIsHalfDay(false);
    };

    if (!isOpen) return null;
    
    const inputClasses = "mt-1 block w-full border border-gray-300 p-2 rounded-md shadow-sm bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500";


    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full" onClick={e => e.stopPropagation()}>
                <h2 className="text-2xl font-bold mb-6 text-gray-800">ขอวันลา</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">วันที่เริ่มลา</label>
                            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputClasses} required />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">ถึงวันที่</label>
                            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={inputClasses} required disabled={isHalfDay} />
                        </div>
                    </div>
                    <div className="flex items-center">
                        <input type="checkbox" id="halfDay" checked={isHalfDay} onChange={(e) => setIsHalfDay(e.target.checked)} className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500" />
                        <label htmlFor="halfDay" className="ml-2 block text-sm text-gray-900">ลาครึ่งวัน (0.5 วัน)</label>
                    </div>

                    {duration > 0 && (
                        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-center">
                            <p className="font-semibold text-blue-800">
                                ระยะเวลาที่ลา: {duration} วัน
                            </p>
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-gray-700">ประเภทการลา</label>
                        <select value={type} onChange={(e) => setType(e.target.value as LeaveRequest['type'])} className={inputClasses} required>
                            <option value="sick" disabled={remainingSick <= 0}>ลาป่วย (เหลือ {remainingSick} วัน)</option>
                            <option value="personal" disabled={remainingPersonal <= 0}>ลากิจ (เหลือ {remainingPersonal} วัน)</option>
                            <option value="leave-without-pay">ลาไม่รับเงินเดือน</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">เหตุผล</label>
                        <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} className={inputClasses} required />
                    </div>
                    <div className="text-sm text-gray-500">
                        <p>ลากิจ: {quotas.used.personal}/{quotas.total.personal}</p>
                        <p>ลาป่วย: {quotas.used.sick}/{quotas.total.sick}</p>
                        <p>ลาไม่รับเงินเดือน: {quotas.used.vacation}/{quotas.total.vacation}</p>
                    </div>
                    <div className="flex justify-end gap-2 pt-4">
                        <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300">ยกเลิก</button>
                        <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">ส่งคำขอ</button>
                    </div>
                </form>
            </div>
        </div>
    );
};
