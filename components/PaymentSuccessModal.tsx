import React, { useState, useEffect } from 'react';

interface PaymentSuccessModalProps {
    isOpen: boolean;
    onClose: (shouldPrint: boolean) => void;
    orderNumber: number;
}

export const PaymentSuccessModal: React.FC<PaymentSuccessModalProps> = ({ isOpen, onClose, orderNumber }) => {
    const [shouldPrint, setShouldPrint] = useState(true);

    // Reset the checkbox to be checked every time the modal opens
    useEffect(() => {
        if (isOpen) {
            setShouldPrint(true);
        }
    }, [isOpen]);
    
    if (!isOpen) return null;

    const handleClose = () => {
        onClose(shouldPrint);
    };
    
    // If user clicks the backdrop, treat it as a cancel and don't print.
    const handleBackdropClick = () => {
        onClose(false);
    };

    return (
        <div 
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
            onClick={handleBackdropClick}
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
                <h3 className="text-2xl leading-6 font-bold text-gray-900 mt-5">ชำระเงินสำเร็จ!</h3>
                <div className="mt-3">
                    <p className="text-lg text-gray-600">
                        สำหรับออเดอร์หมายเลข:
                    </p>
                    <p className="text-4xl font-extrabold text-blue-600 my-2">#{String(orderNumber).padStart(3, '0')}</p>
                    <p className="text-md text-gray-500">
                        ขอบคุณที่ใช้บริการ!
                    </p>
                </div>

                <div className="mt-6">
                    <label className="flex items-center justify-center gap-3 text-lg text-gray-700 cursor-pointer p-2 rounded-lg hover:bg-gray-100">
                        <input
                            type="checkbox"
                            checked={shouldPrint}
                            onChange={(e) => setShouldPrint(e.target.checked)}
                            className="h-6 w-6 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="font-medium">พิมพ์ใบเสร็จรับเงิน</span>
                    </label>
                </div>
                
                <div className="mt-6">
                    <button
                        type="button"
                        className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-3 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:text-sm"
                        onClick={handleClose}
                    >
                        ปิด
                    </button>
                </div>
            </div>
        </div>
    );
};