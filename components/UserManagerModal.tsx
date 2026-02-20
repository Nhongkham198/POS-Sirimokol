
import React, { useState, useEffect, useMemo, useRef } from 'react';
import type { User, Branch, Table } from '../types';
import Swal from 'sweetalert2';

interface UserManagerModalProps {
    isOpen: boolean;
    onClose: () => void;
    users: User[];
    setUsers: React.Dispatch<React.SetStateAction<User[]>>;
    currentUser: User;
    branches: Branch[];
    isEditMode: boolean;
    tables?: Table[]; // Added tables prop
}

const initialFormState: Omit<User, 'id'> = { 
    username: '', 
    password: '', 
    role: 'pos' as const,
    allowedBranchIds: [],
    profilePictureUrl: '',
    leaveQuotas: { sick: 30, personal: 6, vacation: 6 }, // Default quotas
    assignedTableId: undefined
};

// --- Image Compression Helper ---
const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target?.result as string;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const maxWidth = 300; // Limit width to 300px
                const scaleSize = maxWidth / img.width;
                const width = (img.width > maxWidth) ? maxWidth : img.width;
                const height = (img.width > maxWidth) ? img.height * scaleSize : img.height;

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    ctx.drawImage(img, 0, 0, width, height);
                    // Compress to JPEG, quality 0.7
                    const base64 = canvas.toDataURL('image/jpeg', 0.7);
                    resolve(base64);
                } else {
                    reject(new Error('Canvas context not found'));
                }
            };
            img.onerror = (error) => reject(error);
        };
        reader.onerror = (error) => reject(error);
    });
};

export const UserManagerModal: React.FC<UserManagerModalProps> = ({ isOpen, onClose, users, setUsers, currentUser, branches, isEditMode, tables = [] }) => {
    const [isAdding, setIsAdding] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [formData, setFormData] = useState<Omit<User, 'id'>>(initialFormState);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        // Reset form when modal is closed
        if (!isOpen) {
            cancelAction();
        }
    }, [isOpen]);

    const usersToDisplay = useMemo(() => {
        if (currentUser.role === 'admin') {
            return users; // Admin sees everyone
        }
        
        // Branch admin only sees users in their branches + system admins
        const currentUserBranches = new Set(currentUser.allowedBranchIds || []);
        return users.filter(user => {
            if (user.role === 'admin') return true; // Always show admins
            const userBranches = user.allowedBranchIds || [];
            // User is visible if they share at least one branch with the current branch-admin
            return userBranches.some(branchId => currentUserBranches.has(branchId));
        });

    }, [users, currentUser]);

    const groupedUsers = useMemo(() => {
        const groups: Record<string, User[]> = {};

        // Determine which branches to display headers for
        const visibleBranches = currentUser.role === 'admin'
            ? branches
            : branches.filter(b => (currentUser.allowedBranchIds || []).includes(b.id));

        // Group system admins separately at the top
        const systemAdmins = usersToDisplay.filter(u => u.role === 'admin');
        if (systemAdmins.length > 0) {
            groups['ผู้ดูแลระบบ'] = systemAdmins;
        }

        // Group Table Users (No branch specific logic yet, just group them)
        const tableUsers = usersToDisplay.filter(u => u.role === 'table');
        if (tableUsers.length > 0) {
            groups['Tablets / โต๊ะลูกค้า'] = tableUsers;
        }

        // Group users by each visible branch (excluding tables/admins to avoid duplicates if possible, or just strict filter)
        visibleBranches.forEach(branch => {
            const usersInBranch = usersToDisplay.filter(user =>
                user.role !== 'admin' && user.role !== 'table' && (user.allowedBranchIds || []).includes(branch.id)
            );
            if (usersInBranch.length > 0) {
                groups[branch.name] = usersInBranch;
            }
        });

        return groups;

    }, [usersToDisplay, branches, currentUser]);


    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value as User['role'] }));
    };

    const handleQuotaChange = (type: 'sick' | 'personal' | 'vacation', value: number) => {
        setFormData(prev => ({
            ...prev,
            leaveQuotas: {
                ...prev.leaveQuotas!,
                [type]: value
            }
        }));
    };

    const handleBranchChange = (branchId: number) => {
        setFormData(prev => {
            const currentIds = prev.allowedBranchIds || [];
            const newAllowedIds = currentIds.includes(branchId)
                ? currentIds.filter(id => id !== branchId)
                : [...currentIds, branchId];
            return { ...prev, allowedBranchIds: newAllowedIds };
        });
    };
    
    const handleChangePicture = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file && file.type.startsWith('image/')) {
            try {
                Swal.fire({
                    title: 'กำลังประมวลผลรูปภาพ...',
                    allowOutsideClick: false,
                    didOpen: () => { Swal.showLoading(); }
                });
                
                const base64 = await compressImage(file);
                
                if (base64.length > 800000) { 
                    Swal.fire('ไฟล์ใหญ่เกินไป', 'รูปภาพมีขนาดใหญ่เกินไป กรุณาใช้รูปที่เล็กกว่านี้ หรือใช้ URL แทน', 'error');
                    return;
                }

                setFormData(prev => ({ ...prev, profilePictureUrl: base64 }));
                Swal.close();
                Swal.fire({ toast: true, icon: 'success', title: 'อัปโหลดรูปสำเร็จ', position: 'top-end', showConfirmButton: false, timer: 1500 });

            } catch (error) {
                console.error("Image upload failed", error);
                Swal.fire('ผิดพลาด', 'ไม่สามารถประมวลผลรูปภาพได้', 'error');
            }
        }
        // Reset input
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleDeletePicture = () => {
        setFormData(prev => ({ ...prev, profilePictureUrl: '' }));
    };


    const handleSave = () => {
        // --- Validations ---
        if (!formData.username.trim()) {
            Swal.fire('ผิดพลาด', 'กรุณากรอกชื่อผู้ใช้', 'error');
            return;
        }

        // Require password only when creating a new user. 
        // When editing, empty password means "keep existing".
        if (!editingUser && !formData.password) {
            Swal.fire('ผิดพลาด', 'กรุณากรอกรหัสผ่าน', 'error');
            return;
        }
    
        if (formData.role !== 'admin' && (!formData.allowedBranchIds || formData.allowedBranchIds.length === 0)) {
            Swal.fire('ข้อมูลไม่ครบถ้วน', 'กรุณากำหนดสิทธิ์สาขาอย่างน้อย 1 สาขา ให้กับผู้ใช้งานนี้', 'warning');
            return;
        }

        // --- Logic ---
        if (editingUser) { // UPDATE
            if (users.some(u => u.username.trim().toLowerCase() === formData.username.trim().toLowerCase() && u.id !== editingUser.id)) {
                Swal.fire('ผิดพลาด', 'ชื่อผู้ใช้นี้มีอยู่แล้ว', 'error');
                return;
            }
            
            setUsers(prevUsers => prevUsers.map(u => {
                if (u.id !== editingUser!.id) {
                    return u;
                }
    
                // Create the updated user object by spreading existing data and applying changes
                const updatedUser: Partial<User> = {
                    ...u,
                    username: formData.username.trim(),
                    role: formData.role,
                    leaveQuotas: formData.leaveQuotas,
                    // FIX: Do NOT set assignedTableId to undefined here, it causes Firestore error.
                    // We handle it below.
                };

                // FIX: Handle assignedTableId carefully
                if (formData.role === 'table') {
                    updatedUser.assignedTableId = Number(formData.assignedTableId);
                } else {
                    // Explicitly delete key if not table role
                    delete updatedUser.assignedTableId;
                }

                // Update password only if a new one is provided AND user is Admin OR Branch Admin
                if (formData.password && (currentUser.role === 'admin' || currentUser.role === 'branch-admin')) {
                    updatedUser.password = formData.password;
                }
    
                // Handle profile picture logic
                if (formData.profilePictureUrl && formData.profilePictureUrl.trim()) {
                    updatedUser.profilePictureUrl = formData.profilePictureUrl;
                } else {
                    delete updatedUser.profilePictureUrl;
                }
    
                // Handle branch ID logic based on role
                if (updatedUser.role === 'admin') {
                    delete updatedUser.allowedBranchIds;
                } else {
                    // For table and other roles, update allowed branches
                    updatedUser.allowedBranchIds = formData.allowedBranchIds || [];
                }
    
                return updatedUser as User;
            }));
            Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'อัปเดตผู้ใช้แล้ว!', showConfirmButton: false, timer: 1500 });

        } else { // ADD
            if (users.some(u => u.username.trim().toLowerCase() === formData.username.trim().toLowerCase())) {
                Swal.fire('ผิดพลาด', 'ชื่อผู้ใช้นี้มีอยู่แล้ว', 'error');
                return;
            }

            const newId = users.length > 0 ? Math.max(...users.map(u => u.id)) + 1 : 1;
            
            const newUser: Omit<User, 'id'> & { id: number } = {
                id: newId,
                username: formData.username.trim(),
                password: formData.password, // Password is mandatory for new users
                role: formData.role,
                leaveQuotas: formData.leaveQuotas,
                // FIX: Do NOT set assignedTableId here initially to avoid undefined.
            };

            // FIX: Add assignedTableId ONLY if role is table
            if (formData.role === 'table') {
                newUser.assignedTableId = Number(formData.assignedTableId);
            }

            if (formData.profilePictureUrl && formData.profilePictureUrl.trim()) {
                newUser.profilePictureUrl = formData.profilePictureUrl;
            }
            
            if (newUser.role !== 'admin') {
                newUser.allowedBranchIds = formData.allowedBranchIds || [];
            }

            setUsers(prev => [...prev, newUser]);
            Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'เพิ่มผู้ใช้แล้ว!', showConfirmButton: false, timer: 1500 });
        }
        
        cancelAction();
    };

    const handleDelete = (userId: number) => {
        Swal.fire({
            title: 'คุณแน่ใจหรือไม่?',
            text: "คุณจะไม่สามารถย้อนกลับการกระทำนี้ได้!",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#d33',
            confirmButtonText: 'ใช่, ลบเลย!',
            cancelButtonText: 'ยกเลิก'
        }).then((result) => {
            if (result.isConfirmed) {
                setUsers(prev => prev.filter(u => u.id !== userId));
                Swal.fire('ลบแล้ว!', 'ผู้ใช้ถูกลบเรียบร้อยแล้ว', 'success');
            }
        });
    };

    const startEdit = (user: User) => {
        setEditingUser(user);
        setIsAdding(false);
        setFormData({ 
            username: user.username, 
            password: currentUser.role === 'admin' ? user.password : '', // Only Admin sees the actual password
            role: user.role, 
            allowedBranchIds: user.allowedBranchIds || [],
            profilePictureUrl: user.profilePictureUrl || '',
            leaveQuotas: user.leaveQuotas || { sick: 30, personal: 6, vacation: 6 },
            assignedTableId: user.assignedTableId
        });
    };

    const cancelAction = () => {
        setEditingUser(null);
        setIsAdding(false);
        setFormData(initialFormState);
    };
    
    if (!isOpen) return null;

    const roleText = (role: User['role']) => {
        switch (role) {
            case 'admin': return 'ผู้ดูแลระบบ';
            case 'branch-admin': return 'ผู้ดูแลสาขา';
            case 'pos': return 'พนักงาน POS';
            case 'kitchen': return 'พนักงานครัว';
            case 'auditor': return 'Auditor';
            case 'table': return 'Tablet / โต๊ะลูกค้า';
        }
    };

    const getBranchNames = (branchIds: number[] | undefined) => {
        if (!branchIds || branchIds.length === 0) return 'ยังไม่กำหนดสาขา';
        return branchIds
            .map(id => branches.find(b => b.id === id)?.name)
            .filter(Boolean)
            .join(', ');
    };

    const getTableName = (tableId: number | undefined) => {
        if (!tableId) return 'ไม่ระบุโต๊ะ';
        const table = tables.find(t => t.id === tableId);
        return table ? `โต๊ะ ${table.name}` : `Unknown Table (${tableId})`;
    };

    // Helper to determine if password editing is allowed
    const canEditPassword = !editingUser || currentUser.role === 'admin' || currentUser.role === 'branch-admin';

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl transform transition-all flex flex-col" style={{maxHeight: '90vh'}} onClick={e => e.stopPropagation()}>
                <div className="p-6 border-b">
                    <h3 className="text-2xl font-bold text-gray-900">จัดการผู้ใช้งาน</h3>
                </div>
                
                <div className="p-6 space-y-3 overflow-y-auto flex-1">
                    {Object.entries(groupedUsers).map(([groupName, list]) => {
                        const userList = list as User[];
                        if (userList.length === 0) return null;

                        return (
                            <div key={groupName}>
                                <h4 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-2 pt-3 border-t first:border-t-0 first:pt-0">{groupName}</h4>
                                <div className="space-y-3">
                                    {userList.map(user => {
                                        const isActionDisabled = (() => {
                                            if (user.id === currentUser.id) return true;
                                            if (user.role === 'admin') return currentUser.role !== 'admin';
                                            if (currentUser.role === 'branch-admin') {
                                                const currentUserBranches = currentUser.allowedBranchIds || [];
                                                const targetUserBranches = user.allowedBranchIds || [];
                                                const hasSharedBranch = currentUserBranches.some(branchId => targetUserBranches.includes(branchId));
                                                return !hasSharedBranch;
                                            }
                                            return false;
                                        })();
                
                                        const disabledTitle = (() => {
                                            if (user.id === currentUser.id) return 'ไม่สามารถดำเนินการกับบัญชีตัวเองได้';
                                            if (user.role === 'admin' && currentUser.role !== 'admin') return 'ไม่มีสิทธิ์จัดการผู้ดูแลระบบ';
                                            if (isActionDisabled) return 'ไม่มีสิทธิ์จัดการผู้ใช้ของสาขาอื่น';
                                            return '';
                                        })();
                
                                        return (
                                            <div key={user.id} className={`flex items-center gap-4 p-3 rounded-md transition-colors ${editingUser?.id === user.id ? 'bg-gray-100' : 'hover:bg-gray-50'}`}>
                                               <img src={user.profilePictureUrl || "https://img.icons8.com/fluency/48/user-male-circle.png"} alt={user.username} className="w-12 h-12 rounded-full object-cover flex-shrink-0 bg-white border border-gray-200" onError={(e) => e.currentTarget.src = "https://img.icons8.com/fluency/48/user-male-circle.png"} />
                                               <div className="flex-1">
                                                    <p className="font-semibold text-gray-800">{user.username}</p>
                                                    <p className="text-sm text-gray-500">
                                                        <span className={`font-semibold ${
                                                            user.role === 'admin' ? 'text-red-600' :
                                                            user.role === 'branch-admin' ? 'text-purple-600' :
                                                            user.role === 'kitchen' ? 'text-orange-600' :
                                                            user.role === 'table' ? 'text-teal-600' :
                                                            user.role === 'auditor' ? 'text-gray-600' :
                                                            'text-blue-600'
                                                        }`}>{roleText(user.role)}</span>
                                                        {user.role !== 'admin' && (
                                                            <>
                                                                <span className="mx-1.5 text-gray-300">&bull;</span>
                                                                <span>สาขา: {getBranchNames(user.allowedBranchIds)}</span>
                                                            </>
                                                        )}
                                                        {user.role === 'table' && (
                                                            <>
                                                                <span className="mx-1.5 text-gray-300">&bull;</span>
                                                                <span>{getTableName(user.assignedTableId)}</span>
                                                            </>
                                                        )}
                                                    </p>
                                               </div>
                                               <div className="flex gap-2">
                                                    <button
                                                        onClick={() => startEdit(user)}
                                                        disabled={isActionDisabled}
                                                        className="p-2 text-blue-600 hover:bg-blue-100 rounded-full disabled:text-gray-400 disabled:hover:bg-transparent disabled:cursor-not-allowed"
                                                        title={isActionDisabled ? disabledTitle : 'แก้ไข'}
                                                    >
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L15.232 5.232z" /></svg>
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(user.id)}
                                                        disabled={isActionDisabled}
                                                        className="p-2 text-red-600 hover:bg-red-100 rounded-full disabled:text-gray-400 disabled:hover:bg-transparent disabled:cursor-not-allowed"
                                                        title={isActionDisabled ? disabledTitle : 'ลบ'}
                                                    >
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                    </button>
                                               </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        )
                    })}
                </div>

                {(isAdding || editingUser) && (
                    <div className="p-6 border-t bg-gray-50 space-y-4 rounded-b-lg">
                        <h4 className="text-lg font-semibold text-gray-800">{editingUser ? `แก้ไขผู้ใช้: ${editingUser.username}` : 'เพิ่มผู้ใช้ใหม่'}</h4>
                        <div className="flex gap-4 items-start">
                             <div className="relative group flex-shrink-0">
                                <img className="h-24 w-24 rounded-full object-cover border-2 border-gray-300 bg-white" src={formData.profilePictureUrl || "https://img.icons8.com/fluency/96/user-male-circle.png"} alt="Profile" onError={(e) => e.currentTarget.src = "https://img.icons8.com/fluency/96/user-male-circle.png"} />
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    onChange={handleFileChange}
                                    accept="image/*"
                                    className="hidden"
                                />
                            </div>
                            <div className="flex-grow space-y-3">
                                {/* NEW URL INPUT FIELD */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">รูปโปรไฟล์ (URL หรือ อัปโหลด)</label>
                                    <div className="flex gap-2 mt-1">
                                        <input 
                                            type="text" 
                                            value={formData.profilePictureUrl || ''} 
                                            onChange={(e) => setFormData(prev => ({ ...prev, profilePictureUrl: e.target.value }))}
                                            placeholder="วางลิงก์รูปภาพ (URL) หรือกดปุ่มอัปโหลด" 
                                            className="flex-1 px-3 py-2 border rounded-md bg-white border-gray-300 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" 
                                        />
                                        <button 
                                            type="button" 
                                            onClick={handleChangePicture} 
                                            className="px-3 py-2 bg-white text-gray-600 rounded-md border border-gray-300 hover:bg-gray-50 flex items-center justify-center"
                                            title="อัปโหลดไฟล์จากเครื่อง"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4-4m0 0l-4-4m4 4V4" />
                                            </svg>
                                        </button>
                                        {formData.profilePictureUrl && (
                                            <button 
                                                type="button" 
                                                onClick={handleDeletePicture} 
                                                className="px-3 py-2 bg-red-50 text-red-600 rounded-md border border-red-200 hover:bg-red-100 flex items-center justify-center"
                                                title="ลบรูป"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                </svg>
                                            </button>
                                        )}
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <input type="text" name="username" value={formData.username} onChange={handleInputChange} placeholder="ชื่อผู้ใช้" className="px-3 py-2 border rounded-md bg-white border-gray-300 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                                    <input 
                                        type="text" 
                                        name="password" 
                                        value={formData.password} 
                                        onChange={handleInputChange} 
                                        placeholder={!canEditPassword ? "ติดต่อ Admin เพื่อเปลี่ยนรหัส" : (editingUser ? "เปลี่ยนรหัสผ่าน (เว้นว่างหากไม่เปลี่ยน)" : "รหัสผ่าน")}
                                        disabled={!canEditPassword}
                                        className={`px-3 py-2 border rounded-md border-gray-300 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 ${!canEditPassword ? 'bg-gray-100 cursor-not-allowed text-gray-500' : 'bg-white'}`} 
                                    />
                                </div>
                                <div>
                                    <select name="role" value={formData.role} onChange={handleInputChange} className="w-full px-3 py-2 border rounded-md bg-white border-gray-300 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500">
                                        <option value="pos">พนักงาน POS</option>
                                        <option value="kitchen">พนักงานครัว</option>
                                        <option value="branch-admin">ผู้ดูแลสาขา</option>
                                        <option value="auditor">Auditor</option>
                                        <option value="table">Tablet / โต๊ะลูกค้า</option>
                                        {currentUser.role === 'admin' && (
                                            <option value="admin">ผู้ดูแลระบบ</option>
                                        )}
                                    </select>
                                </div>
                                
                                {/* Branch Selection - Updated to include 'table' role */}
                                {formData.role !== 'admin' && (
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">กำหนดสิทธิ์สาขา {formData.role === 'table' && '(สาขาที่ Tablet ประจำอยู่)'}:</label>
                                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-2 border rounded-md bg-white max-h-32 overflow-y-auto">
                                            {branches.map(branch => (
                                                <label key={branch.id} className="flex items-center gap-2 p-1.5 rounded hover:bg-gray-100">
                                                    <input 
                                                        type="checkbox"
                                                        checked={(formData.allowedBranchIds || []).includes(branch.id)}
                                                        onChange={() => handleBranchChange(branch.id)}
                                                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                                    />
                                                    <span className="text-gray-800">{branch.name} (#{branch.id})</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Table Assignment (Only for 'table' role) */}
                                {formData.role === 'table' && (
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">ระบุโต๊ะประจำเครื่อง:</label>
                                        <select 
                                            name="assignedTableId" 
                                            value={formData.assignedTableId || ''} 
                                            onChange={handleInputChange} 
                                            className="w-full px-3 py-2 border rounded-md bg-white border-gray-300 text-gray-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
                                        >
                                            <option value="">-- เลือกโต๊ะ (หรือ Guest) --</option>
                                            {tables.map(table => (
                                                <option key={table.id} value={table.id}>{table.name} ({table.floor})</option>
                                            ))}
                                        </select>
                                        <p className="text-xs text-gray-500 mt-1">
                                            * เลือกโต๊ะที่ต้องการให้ Tablet นี้ผูกค่าไว้
                                        </p>
                                    </div>
                                )}
                                
                                {/* Leave Quotas Section */}
                                {currentUser.role === 'admin' && formData.role !== 'admin' && formData.role !== 'branch-admin' && formData.role !== 'table' && (
                                    <div className="pt-2 border-t mt-2">
                                        <label className="block text-sm font-bold text-gray-700 mb-2">โควตาวันลา (ต่อปี):</label>
                                        <div className="grid grid-cols-3 gap-3">
                                            <div>
                                                <label className="block text-xs text-gray-500 mb-1">ลาป่วย</label>
                                                <input 
                                                    type="number" 
                                                    value={formData.leaveQuotas?.sick ?? 30} 
                                                    onChange={(e) => handleQuotaChange('sick', Number(e.target.value))}
                                                    className="w-full px-2 py-1 border rounded text-center"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs text-gray-500 mb-1">ลากิจ</label>
                                                <input 
                                                    type="number" 
                                                    value={formData.leaveQuotas?.personal ?? 6} 
                                                    onChange={(e) => handleQuotaChange('personal', Number(e.target.value))}
                                                    className="w-full px-2 py-1 border rounded text-center"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs text-gray-500 mb-1">ลาไม่รับเงินเดือน</label>
                                                <input 
                                                    type="number" 
                                                    value={formData.leaveQuotas?.vacation ?? 6} 
                                                    onChange={(e) => handleQuotaChange('vacation', Number(e.target.value))}
                                                    className="w-full px-2 py-1 border rounded text-center"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="flex gap-2 justify-end pt-2">
                            <button onClick={cancelAction} className="px-4 py-2 bg-gray-200 rounded-md hover:bg-gray-300">ยกเลิก</button>
                            <button onClick={handleSave} className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700">บันทึก</button>
                        </div>
                    </div>
                )}


                <div className="bg-gray-100 px-6 py-4 flex justify-between items-center rounded-b-lg border-t">
                     {!isAdding && !editingUser ? (
                        <button onClick={() => { setIsAdding(true); }} className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-md hover:bg-blue-700">เพิ่มผู้ใช้</button>
                    ) : (<div></div>)}
                    <button type="button" onClick={onClose} className="px-6 py-2 bg-gray-300 text-gray-800 rounded-md hover:bg-gray-400 font-semibold">
                        ปิด
                    </button>
                </div>
            </div>
        </div>
    );
};
