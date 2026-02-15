import React from 'react';
import type { LeaveRequest } from '../types';

interface DailyLeaveDetailsModalProps {
    isOpen: boolean;
    onClose: () => void;
    date: Date | null;
    leaves: LeaveRequest[];
    onAddNew: () => void;
}

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
        case 'vacation': return 'ลาพักร้อน';
        case 'leave-without-pay': return 'ลาไม่รับเงินเดือน';
        default: return 'อื่นๆ';
    }
};

export const DailyLeaveDetailsModal: React.FC<DailyLeaveDetailsModalProps> = ({ isOpen, onClose, date, leaves, onAddNew }) => {
    if (!isOpen || !date) return null;

    const formattedDate = date.toLocaleDateString('th-TH', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-white rounded-lg shadow-xl p-6 max-w-lg w-full flex flex-col" style={{ minHeight: '300px', maxHeight: '80vh' }} onClick={e => e.stopPropagation()}>
                <h3 className="text-xl font-bold text-gray-900 mb-4">
                    รายละเอียดวันลา: <span className="text-blue-600">{formattedDate}</span>
                </h3>

                <div className="flex-1 overflow-y-auto space-y-4 pr-2">
                    {leaves.length > 0 ? (
                        leaves.map(leave => (
                            <div key={leave.id} className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                                <div className="flex justify-between items-start">
                                    <p className="font-bold text-gray-800">{leave.username}</p>
                                    {getStatusBadge(leave.status)}
                                </div>
                                <p className="text-sm text-gray-600">ประเภท: {getTypeLabel(leave.type)}</p>
                                <p className="text-sm text-gray-600 mt-1">เหตุผล: {leave.reason}</p>
                            </div>
                        ))
                    ) : (
                        <p className="text-gray-500 text-center py-8">ไม่มีข้อมูลการลาในวันนี้</p>
                    )}
                </div>

                <div className="mt-6 pt-4 border-t flex justify-between items-center">
                    <button
                        type="button"
                        onClick={onAddNew}
                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium flex items-center gap-2"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                        </svg>
                        ขอลาสำหรับวันนี้
                    </button>
                    <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 font-medium">
                        ปิด
                    </button>
                </div>
            </div>
        </div>
    );
};