var {
    WebUSB
} = require('usb');
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

app.whenReady().then(() => {
    const icon = nativeImage.createFromPath(path.join(rootPath, 'src/assets/bat_5.png'));
    tray = new Tray(icon);

    const contextMenu = Menu.buildFromTemplate([
        { label: 'Quit', type: 'normal', click: QuitClick }
    ]);

    batteryCheckInterval = setInterval(() => {
        SetTrayDetails(tray);
    }, 30000);

    SetTrayDetails(tray);

    tray.setContextMenu(contextMenu);
    tray.setToolTip('?');
    tray.setTitle('Razer Battery Life');
})

function SetTrayDetails(tray) {
    GetBattery().then(battLife => {
        if (battLife === 0) return;

        let assetPath = GetBatteryIconPath(battLife);

        tray.setImage(nativeImage.createFromPath(path.join(rootPath, assetPath)));
        tray.setToolTip(battLife + '%');
    });
}

function GetBatteryIconPath(val) {
    let iconName;
    iconName = Math.floor(7/10) * 10;
    return `src/assets/battery_${iconName}.png`;
}

function QuitClick() {
    clearInterval(batteryCheckInterval);
    if (process.platform !== 'darwin') app.quit();
};

// mouse stuff
const RazerVendorId = 0x1532;
const RazerProducts = {
    0x00AA: {
        name: 'Razer Basilisk V3 Pro',
        wireless: true,
        transactionId: 0x1f
    },
    0x00AB: {
        name: 'Razer Basilisk V3 Pro',
        wireless: false,
        transactionId: 0x1f
    },
    0x007C: {
        name: "Razer DeathAdder V2 Pro Wired",
        wireless: false,
        transactionId: 0x3f
    },
    0x007D: {
        name: "Razer DeathAdder V2 Pro Wireless",
        wireless: true,
        transactionId: 0x3f
    },
    0x009C: {
        name: "Razer DeathAdder V2 X HyperSpeed",
        wireless: true,
        transactionId: 0x1f
    },
    0x00B6: {
        name: 'Razer Deathadder V3 Pro Wired',
        wireless: true,
        transactionId: 0x1f
    },
    0x00B7: {
        name: 'Razer Deathadder V3 Pro Wireless',
        wireless: true,
        transactionId: 0x1f
    },
    0x0083: {
        name: "Razer Basilsk X HyperSpeed",
        wireless: true,
        transactionId: 0x1f
    },
    0x0086: {
        name: "Razer Basilisk Ultimate",
        wireless: true,
        transactionId: 0x1f
    },
    0x0088: {
        name: "Razer Basilisk Ultimate Dongle",
        wireless: true,
        transactionId: 0x1f
    },
    0x008F: {
        name: 'Razer Naga v2 Pro Wired',
        wireless: false,
        transactionId: 0x1f
    },
    0x0090: {
        name: 'Razer Naga v2 Pro Wireless',
        wireless: true,
        transactionId: 0x1f
    }
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
async function GetMouse() {
    const customWebUSB = new WebUSB({
        // This function can return a promise which allows a UI to be displayed if required
        devicesFound: devices => {
            // let dStr = devices.reduce((acc, d) => acc += `${d.productId}||${d.productName}\r\n`,'')
            // new Notification({title: 'Info', body: dStr}).show()
            return devices.find(device => RazerVendorId && RazerProducts[device.productId] != undefined)
        }
    });

    // Returns device based on injected 'devicesFound' function
    const device = await customWebUSB.requestDevice({
        filters: [{}]
    })

    if (device) {
        return device;
    } else {
        throw new Error('No Razer device found on system');
    }
};
async function GetBattery() {
    try {
        const mouse = await GetMouse();

        const msg = GetMessage(mouse);

        await mouse.open();

        if (mouse.configuration === null) {
            await mouse.selectConfiguration(1)
        }

        await mouse.claimInterface(mouse.configuration.interfaces[0].interfaceNumber);

        const request = await mouse.controlTransferOut({
            requestType: 'class',
            recipient: 'interface',
            request: 0x09,
            value: 0x300,
            index: 0x00
        }, msg)

        await new Promise(res => setTimeout(res, 500));

        const reply = await mouse.controlTransferIn({
            requestType: 'class',
            recipient: 'interface',
            request: 0x01,
            value: 0x300,
            index: 0x00
        }, 90)

        return (reply.data.getUint8(9) / 255 * 100).toFixed(1);
    } catch (error) {
        console.error(error);
    }
};
