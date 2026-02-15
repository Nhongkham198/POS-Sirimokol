import React, { useState, useEffect } from 'react';

export interface ConnectionDetails {
    url: string;
    username?: string;
    password?: string;
}

interface BrokerSetupModalProps {
    onSave: (details: ConnectionDetails) => void;
    currentDetails: ConnectionDetails | null;
}

export const BrokerSetupModal: React.FC<BrokerSetupModalProps> = ({ onSave, currentDetails }) => {
    const [url, setUrl] = useState(currentDetails?.url || '');
    const [username, setUsername] = useState(currentDetails?.username || '');
    const [password, setPassword] = useState(currentDetails?.password || '');
    const [error, setError] = useState('');
    const [copyButtonText, setCopyButtonText] = useState('คัดลอก');
    const [isSecureContext, setIsSecureContext] = useState(false);

    useEffect(() => {
        // Check if the context is secure (HTTPS or localhost)
        // The clipboard API is only available in secure contexts.
        setIsSecureContext(window.isSecureContext);
    }, []);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setError(''); // Clear previous error
        
        const trimmedUrl = url.trim();

        if (!trimmedUrl.startsWith('ws://') && !trimmedUrl.startsWith('wss://')) {
            setError('URL ไม่ถูกต้อง ต้องขึ้นต้นด้วย "ws://" หรือ "wss://"');
            return;
        }
        
        onSave({
            url: trimmedUrl,
            username: username.trim(),
            password: password.trim(),
        });
    };

    const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setUrl(e.target.value);
        if (error) setError('');
    }
    
    const handleCopy = () => {
        const urlToCopy = 'wss://broker.hivemq.com:8884/mqtt';
        if (navigator.clipboard) {
            navigator.clipboard.writeText(urlToCopy).then(() => {
                setCopyButtonText('คัดลอกแล้ว!');
                setTimeout(() => {
                    setCopyButtonText('คัดลอก');
                }, 2000);
            }).catch(err => {
                console.error('Failed to copy text: ', err);
                alert('ไม่สามารถคัดลอกได้');
            });
        }
    };


    return (
        <div className="fixed inset-0 bg-gray-800 bg-opacity-80 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl p-8 w-full max-w-lg">
                <form onSubmit={handleSubmit}>
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">ตั้งค่าการเชื่อมต่อ</h2>
                    <p className="text-gray-600 mb-6">
                        ป้อนข้อมูล MQTT Broker (Server) เพื่อเปิดใช้งานการซิงค์ข้อมูลแบบ Real-time ระหว่างอุปกรณ์
                    </p>
                    
                    <div className="mb-6 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800 space-y-2">
                        <p><strong>คำแนะนำ:</strong> ทุกอุปกรณ์ต้องใช้ Broker URL เดียวกันเพื่อให้ข้อมูลตรงกัน</p>
                        <div>
                             <p>สำหรับการทดสอบ สามารถใช้ Public Broker ฟรีได้ที่:</p>
                             {isSecureContext ? (
                                <div className="flex items-center gap-2 bg-blue-100 p-1 rounded mt-1">
                                    <code className="font-mono text-xs sm:text-sm break-all flex-grow p-1">wss://broker.hivemq.com:8884/mqtt</code>
                                    <button
                                        type="button"
                                        onClick={handleCopy}
                                        className={`flex-shrink-0 px-3 py-1 text-xs font-semibold rounded transition-colors ${
                                            copyButtonText === 'คัดลอก'
                                                ? 'bg-blue-500 text-white hover:bg-blue-600'
                                                : 'bg-green-500 text-white'
                                        }`}
                                    >
                                        {copyButtonText}
                                    </button>
                                </div>
                             ) : (
                                <div className="mt-1 space-y-1">
                                    <input 
                                        type="text" 
                                        readOnly 
                                        value="wss://broker.hivemq.com:8884/mqtt" 
                                        className="w-full font-mono text-xs sm:text-sm p-2 bg-blue-100 border border-blue-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-300" 
                                        onClick={(e) => (e.target as HTMLInputElement).select()}
                                    />
                                    <p className="text-xs text-blue-700">เนื่องจากการเชื่อมต่อไม่ปลอดภัย, กรุณาคัดลอก URL ด้วยตนเอง (กดค้างเพื่อเลือก)</p>
                                </div>
                             )}
                        </div>
                    </div>
                    
                    <div className="space-y-4">
                        <div>
                            <label htmlFor="broker-url" className="block text-sm font-medium text-gray-700">
                                Broker WebSocket URL
                            </label>
                            <input
                                type="text"
                                id="broker-url"
                                value={url}
                                onChange={handleUrlChange}
                                className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 ${error ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'}`}
                                placeholder="wss://broker.hivemq.com:8884/mqtt"
                                required
                                autoFocus
                            />
                            {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
                        </div>

                         <div>
                            <label htmlFor="username" className="block text-sm font-medium text-gray-700">
                                Username (ถ้ามี)
                            </label>
                            <input
                                type="text"
                                id="username"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                                placeholder="Username"
                            />
                        </div>

                         <div>
                            <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                                Password (ถ้ามี)
                            </label>
                            <input
                                type="password"
                                id="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                                placeholder="Password"
                            />
                        </div>
                    </div>

                    <div className="mt-8 flex justify-end">
                        <button
                            type="submit"
                            className="inline-flex justify-center rounded-md border border-transparent shadow-sm px-6 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                        >
                            เชื่อมต่อ
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};