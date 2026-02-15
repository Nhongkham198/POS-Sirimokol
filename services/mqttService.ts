// @ts-nocheck
// Using // @ts-nocheck because the mqtt library is loaded from a CDN script tag, not imported as a module.

interface ConnectionOptions {
    url: string;
    username?: string;
    password?: string;
}

class MqttService {
    private client = null;
    private connectionStatus = 'Disconnected';
    private statusListeners = new Set<(status: string) => void>();
    private messageListeners = new Map<string, Set<(payload: any) => void>>();
    private currentConnectionOptions: ConnectionOptions | null = null;

    connect(options: ConnectionOptions) {
        if (this.client && (this.client.connected || this.client.reconnecting)) {
            // If connection options are the same, do nothing.
            if (JSON.stringify(this.currentConnectionOptions) === JSON.stringify(options)) return;
            this.client.end(true); // Force close existing connection if options are different
        }
        
        this.currentConnectionOptions = options;
        this.updateStatus('Connecting...');

        const connectionObject: any = {
            reconnectPeriod: 2000, // try to reconnect every 2 seconds
        };

        // FIX: The original logic sent empty strings for username/password, which some brokers
        // reject for anonymous connections. This change ensures we only send credentials
        // if they are explicitly provided (i.e., not an empty string), allowing for
        // proper anonymous connections.
        if (options.username) {
            connectionObject.username = options.username;
        }
        if (options.password) {
            connectionObject.password = options.password;
        }
        

        // The mqtt variable is globally available from the script in index.html
        this.client = (window as any).mqtt.connect(options.url, connectionObject);

        this.client.on('connect', () => {
            this.updateStatus('Syncing');
            // Re-subscribe to all topics upon connection/reconnection
            this.messageListeners.forEach((_, topic) => {
                this.client?.subscribe(topic);
            });
        });

        this.client.on('message', (topic, message) => {
            try {
                const payload = JSON.parse(message.toString());
                if(payload.senderId === this.client.options.clientId) return; // Ignore messages from self
                this.messageListeners.get(topic)?.forEach(callback => callback(payload));
            } catch (e) {
                console.error(`Failed to parse message on topic ${topic}`, e);
            }
        });
        
        this.client.on('reconnect', () => this.updateStatus('Reconnecting...'));
        this.client.on('error', (err) => { 
            console.error('MQTT Error:', err.message); 
            // Provide a more specific error message for authorization issues
            if (err.message.includes('Not authorized')) {
                 this.updateStatus('Error: Not Authorized');
            } else {
                 this.updateStatus('Error');
            }
            this.client.end(true); // Stop retrying on critical errors like auth
        });
        this.client.on('offline', () => this.updateStatus('Offline'));
        this.client.on('close', () => this.updateStatus('Disconnected'));
    }
    
    disconnect() {
        if (this.client) {
            this.client.end(true); // true = force close
            this.client = null;
            this.currentConnectionOptions = null;
            this.updateStatus('Disconnected');
        }
    }

    private updateStatus(status: string) {
        this.connectionStatus = status;
        this.statusListeners.forEach(listener => listener(status));
    }

    subscribe(topic: string, callback: (payload: any) => void) {
        if (!this.messageListeners.has(topic)) {
            this.messageListeners.set(topic, new Set());
        }
        this.messageListeners.get(topic)!.add(callback);
        if (this.client && this.client.connected) {
            this.client.subscribe(topic);
        }
        
        // Return an unsubscribe function
        return () => {
            this.messageListeners.get(topic)?.delete(callback);
            if (this.messageListeners.get(topic)?.size === 0) {
                if (this.client && this.client.connected) {
                   this.client.unsubscribe(topic);
                }
                this.messageListeners.delete(topic);
            }
        };
    }

    publish(topic: string, payloadData: any) {
        if (this.client && this.client.connected) {
            const payload = {
                senderId: this.client.options.clientId,
                data: payloadData,
                timestamp: Date.now()
            };
            this.client.publish(topic, JSON.stringify(payload));
        }
    }

    addStatusListener(callback: (status: string) => void) {
        this.statusListeners.add(callback);
        callback(this.connectionStatus); // Immediately notify with current status
        return () => this.statusListeners.delete(callback);
    }
}

export const mqttService = new MqttService();