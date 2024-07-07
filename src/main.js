'use strict'
const logger = require('./logger');
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
const razerVendorId = 0x1532;
const batteryCheckTimeout = 30000 //in ms;
let usbDevices, razerDevices, tray, batteryCheckInterval;

app.whenReady().then(() => {
    onInit();

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
});
function onInit() {
    logger.info({checkInterval: batteryCheckTimeout},'App Start');

    usbDevices = getDeviceList() || [];

    razerDevices = usbDevices.filter(d => d.deviceDescriptor.idVendor == razerVendorId);
    logger.info(`Found ${usbDevices.length} USB device(s) and ${razerDevices.length} Razer product(s)`);

    if (razerDevices.length < 1) {
        logger.warn('No Razer products detected on init');
        new Notification({title: 'Warning', body:'No Razer products detected'}).show();
    }
    if (razerDevices.length > 1) {
        //TODO device select
    }
};
function SetTrayDetails(tray) {
    GetBattery()
        .then(battLife => {
            if (battLife === 0 || battLife === undefined) return;

            let assetPath = GetBatteryIconPath(battLife);

            tray.setImage(nativeImage.createFromPath(path.join(rootPath, assetPath)));
            tray.setToolTip(battLife == 0 ? "Device disconnected" : battLife + '%');
        })
        .catch(err => {
            logger.error(err);
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
    logger.info({target: mouse.name, fn: 'GetMessage'})

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
    usbDevices = getDeviceList();
    
    razerDevices = usbDevices.filter(d => d.deviceDescriptor.idVendor == razerVendorId)

    if (razerDevices && razerDevices.length > 0) {
        logger.info(`Sending to: ${razerProducts[razerDevices[0].deviceDescriptor.idProduct].name}`);
        return razerDevices[0];
    } else {
        throw new Error('No Razer products detected');
    }
};
async function GetBattery() {
    logger.info('Getting Battery Life');
    return new Promise(async (res, reject) => {
        try {
            const mouse = GetMouse();
            const razerProduct = razerProducts[mouse.deviceDescriptor.idProduct];
            const msg = GetMessage(razerProduct);

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
            return reject(error);
        }
    })
};