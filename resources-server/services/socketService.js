const socketIo = require('socket.io');

class SocketService {
    constructor(server) {
        this.io = socketIo(server, {
            cors: {
                origin: "*",
                methods: ["GET", "POST"]
            }
        });
        
        this.setupEventHandlers();
    }
    
    setupEventHandlers() {
        this.io.on('connection', (socket) => {
            console.log('客户端连接:', socket.id);
            
            socket.on('disconnect', () => {
                console.log('客户端断开连接:', socket.id);
            });
            
            socket.on('resource-updated', (data) => {
                socket.broadcast.emit('resource-updated', data);
            });
            
            socket.on('resource-added', (data) => {
                socket.broadcast.emit('resource-added', data);
            });
            
            socket.on('resource-deleted', (data) => {
                socket.broadcast.emit('resource-deleted', data);
            });
        });
    }
    
    // 广播资源更新事件
    broadcastResourceUpdate(data) {
        this.io.emit('resource-updated', data);
    }
    
    // 广播资源添加事件
    broadcastResourceAdded(data) {
        this.io.emit('resource-added', data);
    }
    
    // 广播资源删除事件
    broadcastResourceDeleted(data) {
        this.io.emit('resource-deleted', data);
    }
    
    // 获取Socket.IO实例
    getIO() {
        return this.io;
    }
}

module.exports = SocketService;
