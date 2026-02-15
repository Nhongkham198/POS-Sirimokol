import React, { useState } from 'react';
import type { ActiveOrder, CancellationReason } from '../types';
import { CANCELLATION_REASONS } from '../types';

interface CancelOrderModalProps {
    isOpen: boolean;
    order: ActiveOrder | null;
    onClose: () => void;
    onConfirm: (order: ActiveOrder, reason: CancellationReason, notes?: string) => void;
}

export const CancelOrderModal: React.FC<CancelOrderModalProps> = ({ isOpen, order, onClose, onConfirm }) => {
    const [reason, setReason] = useState<CancellationReason | ''>('');
    const [notes, setNotes] = useState('');

    if (!isOpen || !order) return null;

    const handleConfirm = () => {
        if (!reason) {
            alert('กรุณาระบุเหตุผลในการยกเลิก');
            return;
        }
        onConfirm(order, reason, notes);
    };
    
    const floorText = order.floor === 'lower' ? 'ชั้นล่าง' : 'ชั้นบน';

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md transform transition-all" onClick={e => e.stopPropagation()}>
                <div className="p-6 border-b">
                    <h3 className="text-2xl font-bold text-gray-900">ยืนยันการยกเลิกออเดอร์</h3>
                    <p className="text-sm text-gray-500 mt-1">
                        ออเดอร์ #{order.orderNumber} (โต๊ะ {order.tableName} - {floorText})
                    </p>
                </div>

                <div className="p-6 space-y-4">
                    <h4 className="font-semibold text-gray-700">กรุณาระบุเหตุผล:</h4>
                    <div className="space-y-2">
                        {CANCELLATION_REASONS.map(r => (
                            <label key={r} className="flex items-center p-3 rounded-lg hover:bg-gray-50 cursor-pointer">
                                <input
                                    type="radio"
                                    name="cancel-reason"
                                    value={r}
                                    checked={reason === r}
                                    onChange={() => setReason(r)}
                                    className="h-4 w-4 text-red-600 border-gray-300 focus:ring-red-500"
                                />
                                <span className="ml-3 text-gray-800">{r}</span>
                            </label>
                        ))}
                    </div>
                    {reason === 'อื่นๆ' && (
                        <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="ระบุเหตุผลเพิ่มเติม..."
                            className="mt-2 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm"
                            rows={3}
                        />
                    )}
                </div>

                <div className="bg-gray-50 px-6 py-4 flex justify-end gap-3 rounded-b-lg border-t">
                    <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 font-semibold">
                        กลับ
                    </button>
                    <button 
                        type="button" 
                        onClick={handleConfirm}
                        disabled={!reason || (reason === 'อื่นๆ' && !notes.trim())}
                        className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 font-semibold disabled:bg-gray-400"
                    >
                        ยืนยันการยกเลิก
                    </button>
                </div>
            </div>
        </div>
    );
};