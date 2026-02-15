import React, { useState, useMemo } from 'react';
import type { StockItem } from '../types';
import Swal from 'sweetalert2';

interface UnitManagerModalProps {
    isOpen: boolean;
    onClose: () => void;
    units: string[];
    setUnits: React.Dispatch<React.SetStateAction<string[]>>;
    stockItems: StockItem[];
}

export const UnitManagerModal: React.FC<UnitManagerModalProps> = ({ isOpen, onClose, units, setUnits, stockItems }) => {
    const [newUnitName, setNewUnitName] = useState('');

    const unitsInUse = useMemo(() => {
        return new Set(stockItems.map(item => item.unit));
    }, [stockItems]);

    const handleAddUnit = () => {
        const trimmedName = newUnitName.trim();
        if (trimmedName && !units.some(u => u.toLowerCase() === trimmedName.toLowerCase())) {
            setUnits(prev => [...prev, trimmedName]);
            setNewUnitName('');
        } else if (trimmedName) {
            Swal.fire('มีอยู่แล้ว', 'หน่วยนับนี้มีอยู่ในระบบแล้ว', 'warning');
        }
    };

    const handleDeleteUnit = (unitToDelete: string) => {
        if (unitsInUse.has(unitToDelete)) {
            const itemsUsingUnit = stockItems
                .filter(item => item.unit === unitToDelete)
                .map(item => item.name)
                .slice(0, 5); // Limit to 5 for readability

            const listHtml = `<ul class="text-left list-disc list-inside mt-2">${itemsUsingUnit.map(name => `<li>${name}</li>`).join('')}</ul>`;

            Swal.fire({
                icon: 'error',
                title: 'ไม่สามารถลบได้',
                html: `หน่วยนับ <b>"${unitToDelete}"</b> กำลังถูกใช้งานโดยรายการต่อไปนี้:<br/>${listHtml}<br/>กรุณาเปลี่ยนหน่วยนับของรายการเหล่านี้ก่อน`,
            });
            return;
        }

        Swal.fire({
            title: `ลบหน่วยนับ "${unitToDelete}"?`,
            text: "คุณแน่ใจหรือไม่? การกระทำนี้ไม่สามารถย้อนกลับได้",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            confirmButtonText: 'ใช่, ลบเลย',
            cancelButtonText: 'ยกเลิก'
        }).then((result) => {
            if (result.isConfirmed) {
                setUnits(prev => prev.filter(u => u !== unitToDelete));
                Swal.fire({
                    toast: true,
                    position: 'top-end',
                    icon: 'success',
                    title: `ลบ "${unitToDelete}" แล้ว`,
                    showConfirmButton: false,
                    timer: 1500
                });
            }
        });
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[70] p-4" onClick={onClose}>
            <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full flex flex-col" style={{maxHeight: '80vh'}} onClick={e => e.stopPropagation()}>
                <h2 className="text-xl font-bold mb-4 text-gray-900">จัดการหน่วยนับ</h2>
                
                <div className="flex-1 overflow-y-auto space-y-2 mb-4 pr-2">
                    {units.map(unit => {
                        const isUnitInUse = unitsInUse.has(unit);
                        return (
                            <div key={unit} className="flex items-center justify-between bg-gray-50 p-2 rounded-md">
                                <span className="text-gray-800">{unit}</span>
                                <button 
                                    onClick={() => handleDeleteUnit(unit)}
                                    className={`p-1 rounded-full transition-colors ${isUnitInUse ? 'text-gray-400 cursor-help' : 'text-red-500 hover:bg-red-100'}`}
                                    title={isUnitInUse ? 'หน่วยนับนี้กำลังถูกใช้งาน (คลิกเพื่อดูรายละเอียด)' : 'ลบหน่วยนับ'}
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                </button>
                            </div>
                        );
                    })}
                </div>

                <div className="border-t pt-4">
                    <label className="block text-sm font-medium text-gray-700">เพิ่มหน่วยนับใหม่</label>
                    <div className="mt-1 flex gap-2">
                        <input
                            type="text"
                            value={newUnitName}
                            onChange={(e) => setNewUnitName(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleAddUnit()}
                            placeholder="เช่น ขวด, ถุง"
                            className="flex-grow border border-gray-300 p-2 rounded-md shadow-sm bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <button onClick={handleAddUnit} className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-md hover:bg-blue-700">
                            เพิ่ม
                        </button>
                    </div>
                </div>
                
                <div className="flex justify-end mt-6">
                    <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300">
                        ปิด
                    </button>
                </div>
            </div>
        </div>
    );
};