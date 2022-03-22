
let time = new Date().getTime()

function getUniqueId(){
    time = time + 10
    return time/1000;
}

function getVariable(){
    return `Variable: Time\r\nValue: ${ new Date().getTime() }`
}

const data = []
for(let i = 0; i < 1000; i++){
    const Uniqueid = getUniqueId()
    const Variable = getVariable()
    data.push(Buffer.from(`Event: Newchannel\r\nPrivilege: call,all\r\nChannel: PJSIP/channel-00000001\r\nUniqueid: ${Uniqueid}\r\nChannelState: 3\r\nChannelStateDesc: Up\r\nCallerIDNum: 657-5309\r\nCallerIDName: SuperStar\r\nConnectedLineName:\r\nConnectedLineNum:\r\nAccountCode: Cartoon\r\nPriority:\r\nExten: 31337\r\n${Variable}\r\nContext: inbound\r\n\r\n`))
}

module.exports = data