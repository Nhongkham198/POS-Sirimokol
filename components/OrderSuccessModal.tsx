

import React from 'react';

interface OrderSuccessModalProps {
    isOpen: boolean;
    onClose: () => void;
    orderId: number;
    warningMessage?: string | null;
}

export const OrderSuccessModal: React.FC<OrderSuccessModalProps> = ({ isOpen, onClose, orderId, warningMessage }) => {
    if (!isOpen) return null;

    return (
        <div 
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
            // FIX: Wrap onClose in an arrow function to prevent passing the event object.
            onClick={() => onClose()}
        >
            <div 
                className="bg-white rounded-lg shadow-xl p-8 max-w-sm w-full text-center transform transition-all"
                onClick={e => e.stopPropagation()}
            >
                <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100">
                    <svg className="h-10 w-10 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                    </svg>
                </div>
                <h3 className="text-2xl leading-6 font-bold text-gray-900 mt-5">ยืนยันออเดอร์สำเร็จ!</h3>
                <div className="mt-3">
                    <p className="text-lg text-gray-600">
                        หมายเลขออเดอร์ของคุณคือ:
                    </p>
                    <p className="text-4xl font-extrabold text-blue-600 my-2">#{String(orderId).padStart(3, '0')}</p>
                    <p className="text-md text-gray-500">
                        กำลังเตรียมอาหารให้คุณ...
                    </p>
                </div>

                {warningMessage && (
                    <div className="mt-4 p-3 bg-yellow-100 border-l-4 border-yellow-400 text-yellow-800 text-left">
                        <div className="flex">
                            <div className="py-1">
                                <svg className="h-5 w-5 text-yellow-500 mr-3" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.21 3.03-1.742 3.03H4.42c-1.532 0-2.492-1.696-1.742-3.03l5.58-9.92zM10 13a1 1 0 110-2 1 1 0 010 2zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                </svg>
                            </div>
                            <div>
                                <p className="font-bold text-sm">Backend ไม่ตอบสนอง</p>
                                <p className="text-xs">ออเดอร์ถูกบันทึกโดยตรงเรียบร้อยแล้ว (โหมดสำรอง)</p>
                            </div>
                        </div>
                    </div>
                )}

                <div className="mt-8">
                    <button
                        type="button"
                        className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:text-sm"
                        // FIX: Wrap onClose in an arrow function to prevent passing the event object.
                        onClick={() => onClose()}
                    >
                        ปิด
                    </button>
                </div>
            </div>
        </div>
    );
};