'use strict'
var { usb, getDeviceList } = require('usb');
const { bmRequestType, DIRECTION, TYPE, RECIPIENT } = require('bmrequesttype');
var razerProducts = require('./products');

const {
    app,
    Tray,
    Menu,
    nativeImage,
    Notification
} = require('electron');
if (require('electron-squirrel-startup')) app.quit();

const path = require('path');
const rootPath = app.getAppPath();
let tray;
let batteryCheckInterval;
const razerVendorId = 0x1532;
const batteryCheckTimeout = 30000 //in ms;

app.whenReady().then(() => {
    const icon = nativeImage.createFromPath(path.join(rootPath, 'src/assets/battery_0.png'));
    tray = new Tray(icon);

    const contextMenu = Menu.buildFromTemplate([
        { label: 'Quit', type: 'normal', click: QuitClick }
    ]);

    batteryCheckInterval = setInterval(() => {
        SetTrayDetails(tray);
    }, batteryCheckTimeout);

    SetTrayDetails(tray);

    tray.setContextMenu(contextMenu);
    tray.setToolTip('Searching for device');
    tray.setTitle('Razer battery life');

    const devices = getDeviceList();
    
    const razerDevices = devices.filter(d => d.deviceDescriptor.idVendor == razerVendorId)

    let deviceStr = '';
    for (const d of razerDevices) {
        deviceStr += `vid: ${d.deviceDescriptor.idVendor} | pid: ${d.deviceDescriptor.idProduct} | name: ${razerProducts[d.deviceDescriptor.idProduct]?razerProducts[d.deviceDescriptor.idProduct].name:'unknown'} \n`
    }
    new Notification({title: 'Info', body: deviceStr}).show()
});
function SetTrayDetails(tray) {
    GetBattery().then(battLife => {
        if (battLife === 0 || battLife === undefined) return;

        let assetPath = GetBatteryIconPath(battLife);

        tray.setImage(nativeImage.createFromPath(path.join(rootPath, assetPath)));
        tray.setToolTip(battLife == 0 ? "Device disconnected" : battLife + '%');
    });
};
function GetBatteryIconPath(val) {
    let iconName;
    iconName = Math.floor(val/10) * 10;
    return `src/assets/battery_${iconName}.png`;
};
function QuitClick() {
    clearInterval(batteryCheckInterval);
    if (process.platform !== 'darwin') app.quit();
};
function GetMessage(mouse) {
    // Function that creates and returns the message to be sent to the device
    let msg = Buffer.from([0x00, mouse.transactionId, 0x00, 0x00, 0x00, 0x02, 0x07, 0x80]);
    let crc = 0;

    for (let i = 2; i < msg.length; i++) {
        crc = crc ^ msg[i];
    }

    // the next 80 bytes would be storing the data to be sent, but for getting the battery no data is sent
    msg = Buffer.concat([msg, Buffer.alloc(80)])

    // the last 2 bytes would be the crc and a zero byte
    msg = Buffer.concat([msg, Buffer.from([crc, 0])]);

    return msg;
};
function GetMouse() {
    const devices = getDeviceList();
    
    const razerDevices = devices.filter(d => d.deviceDescriptor.idVendor == razerVendorId)

    if (razerDevices && razerDevices.length > 0) {
        return razerDevices[0];
    } else {
        throw new Error('No Razer device found on system');
    }
};
async function GetBattery() {
    return new Promise(async res => {
        try {
            const mouse = GetMouse();

            const msg = GetMessage(razerProducts[mouse.deviceDescriptor.idProduct]);

            mouse.open();

            if (mouse.configDescriptor.bConfigurationValue === null) {
                mouse.setConfiguration(1)
            }

            mouse.interfaces[0].claim();

            mouse.controlTransfer(
                bmRequestType(DIRECTION.Out, TYPE.Class, RECIPIENT.Interface),
                0x09, 0x300, 0x00, msg
            )

            await new Promise(res => setTimeout(res, 1000)); 

            mouse.controlTransfer(
                bmRequestType(DIRECTION.In, TYPE.Class, RECIPIENT.Interface),
                0x01, 0x300, 0x00, 90,
                (err, data) => {
                    if (err) {
                        console.error('Error during control transfer:', err);
                    } else {
                        return res((data.readUInt8(9) / 255 * 100).toFixed(1));
                    }
                }
            )
        } catch (error) {
            console.error(error);
        }
    })
}