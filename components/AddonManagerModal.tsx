import React from 'react';

// Placeholder props, not functional after revert
interface AddonManagerModalProps {
    isOpen: boolean;
    onClose: () => void;
    addonGroups: any[];
    onSave: (updatedGroups: any[]) => void;
}

export const AddonManagerModal: React.FC<AddonManagerModalProps> = ({ isOpen, onClose }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl p-6" onClick={e => e.stopPropagation()}>
                <h3 className="text-2xl font-bold text-gray-900">จัดการ Add-on</h3>
                <p className="mt-2 text-gray-600">This feature has been disabled.</p>
                <div className="mt-4 flex justify-end">
                    <button type="button" onClick={onClose} className="px-6 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 font-semibold">
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};