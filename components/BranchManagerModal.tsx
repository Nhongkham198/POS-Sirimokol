
import React, { useState } from 'react';
import type { Branch, User } from '../types';
import Swal from 'sweetalert2';

interface BranchManagerModalProps {
    isOpen: boolean;
    onClose: () => void;
    branches: Branch[];
    setBranches: React.Dispatch<React.SetStateAction<Branch[]>>;
    currentUser: User | null;
}

const initialFormState = { name: '', location: '' };

export const BranchManagerModal: React.FC<BranchManagerModalProps> = ({ isOpen, onClose, branches, setBranches, currentUser }) => {
    const [isAdding, setIsAdding] = useState(false);
    const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
    const [formData, setFormData] = useState<{ name: string; location?: string }>(initialFormState);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };
    
    const cancelAction = () => {
        setEditingBranch(null);
        setIsAdding(false);
        setFormData(initialFormState);
    };

    const handleSave = () => {
        if (!formData.name.trim()) {
            Swal.fire('ผิดพลาด', 'กรุณากรอกชื่อสาขา', 'error');
            return;
        }

        if (editingBranch) { // Update
            setBranches(prev => prev.map(b => b.id === editingBranch.id ? { ...editingBranch, ...formData } : b));
            Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'อัปเดตสาขาแล้ว!', showConfirmButton: false, timer: 1500 });
        } else { // Add
            const newBranch: Branch = {
                id: Math.max(0, ...branches.map(b => b.id)) + 1,
                ...formData
            };
            setBranches(prev => [...prev, newBranch]);
            Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'เพิ่มสาขาใหม่แล้ว!', showConfirmButton: false, timer: 1500 });
        }
        cancelAction();
    };
    
    const handleDelete = (branch: Branch) => {
        // Simple check, a real app would need to check if users or orders are tied to this branch
        Swal.fire({
            title: `คุณแน่ใจหรือไม่ที่จะลบสาขา "${branch.name}"?`,
            text: "ข้อมูลทั้งหมดของสาขานี้จะถูกลบและไม่สามารถกู้คืนได้!",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'ใช่, ลบเลย!',
            cancelButtonText: 'ยกเลิก'
        }).then((result) => {
            if (result.isConfirmed) {
                setBranches(prev => prev.filter(b => b.id !== branch.id));
                Swal.fire('ลบแล้ว!', `สาขา ${branch.name} ถูกลบเรียบร้อยแล้ว`, 'success');
            }
        });
    };
    
    const startEdit = (branch: Branch) => {
        setEditingBranch(branch);
        setIsAdding(false);
        setFormData({ name: branch.name, location: branch.location || '' });
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl transform transition-all flex flex-col" style={{maxHeight: '90vh'}} onClick={e => e.stopPropagation()}>
                <div className="p-6 border-b">
                    <h3 className="text-2xl font-bold text-gray-900">จัดการสาขา</h3>
                </div>
                
                <div className="p-6 space-y-3 overflow-y-auto flex-1">
                    {branches.map(branch => (
                        <div key={branch.id} className={`flex items-center gap-2 p-2 rounded-md transition-colors ${editingBranch?.id === branch.id ? 'bg-gray-100' : 'hover:bg-gray-50'}`}>
                           <div className="flex-1">
                                <p className="font-semibold text-gray-800">{branch.name}</p>
                                {branch.location && <p className="text-sm text-gray-500">{branch.location}</p>}
                           </div>
                           <div className="flex gap-2">
                                <button onClick={() => startEdit(branch)} className="p-2 text-blue-600 hover:bg-blue-100 rounded-full" title="แก้ไข">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L15.232 5.232z" /></svg>
                                </button>
                                <button onClick={() => handleDelete(branch)} className="p-2 text-red-600 hover:bg-red-100 rounded-full" title="ลบ">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                </button>
                           </div>
                        </div>
                    ))}
                </div>

                {(isAdding || editingBranch) && (
                    <div className="p-6 border-t bg-gray-50 space-y-3 rounded-b-lg">
                        <h4 className="text-lg font-semibold text-gray-800">{editingBranch ? 'แก้ไขสาขา' : 'เพิ่มสาขาใหม่'}</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <input type="text" name="name" value={formData.name} onChange={handleInputChange} placeholder="ชื่อสาขา (เช่น สยาม)" className="px-3 py-2 border rounded-md bg-white border-gray-300 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                            <input type="text" name="location" value={formData.location} onChange={handleInputChange} placeholder="ที่ตั้ง (ถ้ามี)" className="px-3 py-2 border rounded-md bg-white border-gray-300 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                        </div>
                        <div className="flex gap-2 justify-end pt-2">
                            <button onClick={cancelAction} className="px-4 py-2 bg-gray-200 rounded-md hover:bg-gray-300">ยกเลิก</button>
                            <button onClick={handleSave} className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700">บันทึก</button>
                        </div>
                    </div>
                )}


                <div className="bg-gray-100 px-6 py-4 flex justify-between items-center rounded-b-lg border-t">
                     {!isAdding && !editingBranch ? (
                        <button onClick={() => { setIsAdding(true); setEditingBranch(null); setFormData(initialFormState); }} className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-md hover:bg-blue-700">เพิ่มสาขาใหม่</button>
                    ) : (<div></div>)}
                    <button type="button" onClick={onClose} className="px-6 py-2 bg-gray-300 text-gray-800 rounded-md hover:bg-gray-400 font-semibold">
                        ปิด
                    </button>
                </div>
            </div>
        </div>
    );
};
