const { app, BrowserWindow, Menu, protocol, net, shell } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const ROOT = path.join(__dirname, '..');

protocol.registerSchemesAsPrivileged([
    { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true } }
]);

function createWindow() {
    const win = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 900,
        minHeight: 600,
        backgroundColor: '#16181d',
        title: 'Speaker Box Designer',
        icon: path.join(ROOT, 'build', 'icon.png'),
        webPreferences: { contextIsolation: true, sandbox: true }
    });
    win.webContents.setWindowOpenHandler(({ url }) => {
        if (/^https?:/.test(url)) shell.openExternal(url);
        return { action: 'deny' };
    });
    win.loadURL('app://local/index.html');
}

app.whenReady().then(() => {
    protocol.handle('app', (request) => {
        const { pathname } = new URL(request.url);
        const file = path.normalize(path.join(ROOT, decodeURIComponent(pathname)));
        if (!file.startsWith(ROOT)) return new Response('Forbidden', { status: 403 });
        return net.fetch(pathToFileURL(file).toString());
    });
    Menu.setApplicationMenu(null);
    createWindow();
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});
