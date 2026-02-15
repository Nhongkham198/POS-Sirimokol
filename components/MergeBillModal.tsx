import React, { useState, useMemo } from 'react';
import type { ActiveOrder, Table } from '../types';
import Swal from 'sweetalert2';

interface MergeBillModalProps {
    isOpen: boolean;
    onClose: () => void;
    order: ActiveOrder | null; // The order that initiated the merge
    allActiveOrders: ActiveOrder[];
    tables: Table[];
    onConfirmMerge: (
        sourceOrderIds: number[],
        targetOrderId: number
    ) => void;
}

export const MergeBillModal: React.FC<MergeBillModalProps> = ({
    isOpen,
    onClose,
    order,
    allActiveOrders,
    tables,
    onConfirmMerge,
}) => {
    const [activeTab, setActiveTab] = useState<'intra-table' | 'inter-table'>('intra-table');

    // State for intra-table merge
    const [selectedOrderIds, setSelectedOrderIds] = useState<Set<number>>(new Set());

    // State for inter-table merge
    const [selectedTargetOrderId, setSelectedTargetOrderId] = useState<number | null>(null);

    const otherOrdersOnSameTable = useMemo(() => {
        if (!order) return [];
        return allActiveOrders.filter(o =>
            o.id !== order.id &&
            o.tableName === order.tableName &&
            o.floor === order.floor
        );
    }, [allActiveOrders, order]);

    const otherTablesWithOrders = useMemo(() => {
        if (!order) return [];
        const otherOrders = allActiveOrders.filter(o => o.tableName !== order.tableName || o.floor !== order.floor);
        const uniqueTableOrders: ActiveOrder[] = [];
        const seenTables = new Set<string>();
        for (const o of otherOrders) {
            const key = `${o.tableName}-${o.floor}`;
            if (!seenTables.has(key)) {
                uniqueTableOrders.push(o);
                seenTables.add(key);
            }
        }
        return uniqueTableOrders;
    }, [allActiveOrders, order]);


    const handleToggleSelection = (orderId: number) => {
        setSelectedOrderIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(orderId)) {
                newSet.delete(orderId);
            } else {
                newSet.add(orderId);
            }
            return newSet;
        });
    };

    const handleIntraTableMerge = () => {
        if (!order || selectedOrderIds.size === 0) return;

        Swal.fire({
            title: 'ยืนยันการรวมบิล?',
            text: `คุณต้องการรวม ${selectedOrderIds.size} บิลเข้ากับบิลนี้ใช่หรือไม่?`,
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'ยืนยัน',
            cancelButtonText: 'ยกเลิก',
        }).then((result) => {
            if (result.isConfirmed) {
                onConfirmMerge(Array.from(selectedOrderIds), order.id);
                onClose();
            }
        });
    };

    const handleInterTableMerge = () => {
        if (!order || selectedTargetOrderId === null) return;
        const targetOrder = allActiveOrders.find(o => o.id === selectedTargetOrderId);
        if (!targetOrder) return;

        Swal.fire({
            title: 'ยืนยันการย้ายและรวมบิล?',
            text: `คุณต้องการย้ายออเดอร์นี้ไปรวมกับโต๊ะ ${targetOrder.tableName} ใช่หรือไม่?`,
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'ยืนยัน',
            cancelButtonText: 'ยกเลิก',
        }).then((result) => {
            if (result.isConfirmed) {
                onConfirmMerge([order.id], selectedTargetOrderId);
                onClose();
            }
        });
    };

    if (!isOpen || !order) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-white rounded-lg shadow-xl w-full max-w-lg transform transition-all flex flex-col" style={{maxHeight: '90vh'}} onClick={e => e.stopPropagation()}>
                <header className="p-6 border-b">
                    <h3 className="text-2xl font-bold text-gray-900">รวมบิล</h3>
                    <p className="text-sm text-gray-500 mt-1">
                        จัดการบิลสำหรับโต๊ะ {order.tableName} (ออเดอร์ #{order.orderNumber})
                    </p>
                </header>

                <div className="flex border-b">
                    <button
                        onClick={() => setActiveTab('intra-table')}
                        className={`flex-1 py-3 text-center font-semibold ${activeTab === 'intra-table' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500 hover:bg-gray-50'}`}
                    >
                        รวมในโต๊ะเดียวกัน
                    </button>
                    <button
                        onClick={() => setActiveTab('inter-table')}
                        className={`flex-1 py-3 text-center font-semibold ${activeTab === 'inter-table' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500 hover:bg-gray-50'}`}
                    >
                        รวมกับโต๊ะอื่น
                    </button>
                </div>

                <main className="flex-1 overflow-y-auto p-6 space-y-4">
                    {activeTab === 'intra-table' && (
                        <div>
                            <p className="text-gray-600 mb-4">เลือกบิลย่อยที่ต้องการรวมเข้ากับบิลปัจจุบัน (#{order.orderNumber})</p>
                            {otherOrdersOnSameTable.length > 0 ? (
                                <div className="space-y-2">
                                    {otherOrdersOnSameTable.map(o => (
                                        <label key={o.id} className="flex items-center gap-4 p-3 rounded-lg border hover:bg-gray-50 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={selectedOrderIds.has(o.id)}
                                                onChange={() => handleToggleSelection(o.id)}
                                                className="h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                            />
                                            <span className="font-semibold text-gray-800">ออเดอร์ #{o.orderNumber}</span>
                                        </label>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-center text-gray-500 py-4">ไม่มีบิลอื่นในโต๊ะนี้ให้รวม</p>
                            )}
                        </div>
                    )}
                    {activeTab === 'inter-table' && (
                        <div>
                            <p className="text-gray-600 mb-4">เลือกโต๊ะปลายทางที่ต้องการย้ายออเดอร์นี้ไปรวม</p>
                             {otherTablesWithOrders.length > 0 ? (
                                <div className="space-y-2">
                                    {otherTablesWithOrders.map(o => (
                                        <label key={o.id} className="flex items-center gap-4 p-3 rounded-lg border hover:bg-gray-50 cursor-pointer">
                                            <input
                                                type="radio"
                                                name="target-table-merge"
                                                checked={selectedTargetOrderId === o.id}
                                                onChange={() => setSelectedTargetOrderId(o.id)}
                                                className="h-5 w-5 text-blue-600 border-gray-300 focus:ring-blue-500"
                                            />
                                            <span className="font-semibold text-gray-800">โต๊ะ {o.tableName} ({o.floor})</span>
                                        </label>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-center text-gray-500 py-4">ไม่มีโต๊ะอื่นที่มีออเดอร์อยู่</p>
                            )}
                        </div>
                    )}
                </main>

                <footer className="bg-gray-50 px-6 py-4 flex justify-end gap-3 rounded-b-lg border-t">
                    <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 font-semibold">
                        ยกเลิก
                    </button>
                    {activeTab === 'intra-table' && (
                         <button
                            type="button"
                            onClick={handleIntraTableMerge}
                            disabled={selectedOrderIds.size === 0}
                            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-semibold disabled:bg-gray-400"
                        >
                            รวมบิลที่เลือก
                        </button>
                    )}
                    {activeTab === 'inter-table' && (
                        <button
                            type="button"
                            onClick={handleInterTableMerge}
                            disabled={selectedTargetOrderId === null}
                            className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 font-semibold disabled:bg-gray-400"
                        >
                            ย้ายและรวม
                        </button>
                    )}
                </footer>
            </div>
        </div>
    );
};