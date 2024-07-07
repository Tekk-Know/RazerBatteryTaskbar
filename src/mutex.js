const koffi = require('koffi');

const isWin = process.platform === "win32";
if (!isWin){
    module.exports = {
        // Function to create a named mutex
        createNamedMutex: function (name) {
            return 0;
        },

        // Function to acquire the mutex
        acquireMutex: function (mutexHandle, timeout = 2000) {
            return true
        },

        // Function to release the mutex
        releaseMutex: function (mutexHandle) {
        },

        // Function to close the mutex handle
        closeMutexHandle: function (mutexHandle) {
        },
    }
    return;
}

// Load the shared library
const kernel32 = koffi.load('kernel32.dll');

const PackedStruct = koffi.pack('SECURITY_ATTRIBUTES', {
    nLength: koffi.types.long,  //DWORD
    lpSecurityDescriptor: 'void *',    //LPVOID
    bInheritHandle: 'long',  //BOOL
});

// Define the necessary Windows API functions
const CreateMutexW = kernel32.func('int CreateMutexW(SECURITY_ATTRIBUTES lpMutexAttributes, bool bInitialOwner, str lpName)');
const WaitForSingleObject = kernel32.func('long WaitForSingleObject(int hHandle, long dwMilliseconds)');
const ReleaseMutex = kernel32.func('bool ReleaseMutex(int hMutex)');
const CloseHandle = kernel32.func('bool CloseHandle(int hObject)');

// Define constants
const WAIT_OBJECT_0 = 0x00000000;
const WAIT_TIMEOUT = 0x00000102;

module.exports = {
    // Function to create a named mutex
    createNamedMutex: function (name) {
        const mutexName = Buffer.from(name, 'utf16le');
        const mutexHandle = CreateMutexW({}, false, mutexName);


        if (!mutexHandle) {
            throw new Error('Failed to create mutex');
        }
        console.log(mutexHandle)
        return mutexHandle;
    },

    // Function to acquire the mutex
    acquireMutex: function (mutexHandle, timeout = 2000) {
        const result = WaitForSingleObject(mutexHandle, timeout);
        if (result === WAIT_OBJECT_0) {
            return true;
        } else if (result === WAIT_TIMEOUT) {
            throw new Error('Failed to acquire mutex: timeout');
        } else {
            throw new Error('Failed to acquire mutex');
        }
    },

    // Function to release the mutex
    releaseMutex: function (mutexHandle) {
        if (!ReleaseMutex(mutexHandle)) {
            throw new Error('Failed to release mutex');
        }
    },

    // Function to close the mutex handle
    closeMutexHandle: function (mutexHandle) {
        if (!CloseHandle(mutexHandle)) {
            throw new Error('Failed to close mutex handle');
        }
    },
}

