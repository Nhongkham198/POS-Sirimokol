import React, { useMemo } from 'react';
import type { Branch, User } from '../types';

interface BranchSelectionScreenProps {
    onSelectBranch: (branch: Branch) => void;
    currentUser: User;
    branches: Branch[];
    onManageBranches: () => void;
    onLogout: () => void;
}

export const BranchSelectionScreen: React.FC<BranchSelectionScreenProps> = ({ 
    onSelectBranch, 
    currentUser, 
    branches, 
    onManageBranches,
    onLogout
}) => {
    const isAdmin = currentUser.role === 'admin';

    const branchesToShow = useMemo(() => {
        if (isAdmin) {
            return branches;
        }
        return branches.filter(branch => currentUser.allowedBranchIds?.includes(branch.id));
    }, [branches, currentUser, isAdmin]);

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
            <div className="max-w-4xl w-full bg-white rounded-2xl shadow-lg p-8 space-y-6 text-center">
                <h1 className="text-3xl font-bold text-gray-800">
                    ยินดีต้อนรับ, {currentUser.username}!
                </h1>
                <p className="text-lg text-gray-600">
                    กรุณาเลือกสาขาที่ต้องการจัดการ
                </p>

                {branchesToShow.length > 0 ? (
                    <div className="flex flex-wrap justify-center gap-6 pt-4">
                        {branchesToShow.map((branch) => (
                            <button
                                key={branch.id}
                                onClick={() => onSelectBranch(branch)}
                                className="p-6 bg-white border-2 border-gray-200 rounded-xl shadow-sm hover:border-blue-500 hover:shadow-lg hover:-translate-y-1 transform transition-all duration-300 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 min-w-[240px]"
                            >
                                <h2 className="text-xl font-semibold text-black">{branch.name}</h2>
                                {branch.location && (
                                    <p className="text-base text-gray-600 mt-1">{branch.location}</p>
                                )}
                            </button>
                        ))}
                    </div>
                ) : (
                    <div className="py-12 text-center text-gray-500 border-2 border-dashed border-gray-300 rounded-lg">
                        <p className="text-xl">
                            {isAdmin ? 'ยังไม่มีสาขาในระบบ' : 'คุณยังไม่ได้รับมอบหมายให้ดูแลสาขาใด'}
                        </p>
                        {isAdmin ? (
                            <p className="mt-2">กรุณาเพิ่มสาขาแรกของคุณเพื่อเริ่มต้นใช้งาน</p>
                        ) : (
                            <p className="mt-2">กรุณาติดต่อผู้ดูแลระบบเพื่อกำหนดสิทธิ์</p>
                        )}
                    </div>
                )}
                
                <div className="pt-6 border-t border-gray-200">
                     {isAdmin ? (
                        <button
                            onClick={onManageBranches}
                            className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 transition-colors"
                        >
                            จัดการสาขา
                        </button>
                    ) : (
                        branchesToShow.length === 0 && (
                            <button
                                onClick={onLogout}
                                className="px-6 py-3 bg-gray-600 text-white font-semibold rounded-lg shadow-md hover:bg-gray-700 transition-colors"
                            >
                                กลับไปหน้า Login
                            </button>
                        )
                    )}
                </div>
            </div>
        </div>
    );
};