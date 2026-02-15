import React from 'react';

interface OrderTimeoutModalProps {
    isOpen: boolean;
    onClose: () => void;
    orderId: number | null;
}

export const OrderTimeoutModal: React.FC<OrderTimeoutModalProps> = ({ isOpen, onClose, orderId }) => {
    if (!isOpen) return null;

    return (
        <div 
            className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50"
            onClick={onClose}
        >
            <div 
                className="bg-white rounded-lg shadow-xl p-8 max-w-sm w-full text-center transform transition-all"
                onClick={e => e.stopPropagation()}
            >
                <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-100">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-red-600" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                </div>
                <h3 className="text-2xl leading-6 font-bold text-gray-900 mt-5">แจ้งเตือน!</h3>
                <div className="mt-3">
                    <p className="text-lg text-gray-600">
                        ลูกค้ารออาหารนานเกินไปสำหรับออเดอร์:
                    </p>
                    <p className="text-4xl font-extrabold text-red-600 my-2">#{String(orderId).padStart(4, '0')}</p>
                    <p className="text-md text-gray-500">
                        กรุณาเร่งดำเนินการ
                    </p>
                </div>
                <div className="mt-8">
                    <button
                        type="button"
                        className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 sm:text-sm"
                        onClick={onClose}
                    >
                        รับทราบ
                    </button>
                </div>
            </div>
        </div>
    );
};