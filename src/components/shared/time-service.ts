import { Service } from "typedi";

import moment = require('moment')
import { DurationInputArg1, DurationInputArg2, ISO_8601 } from 'moment'

@Service()
export class TimeService {

    public timeZone: string = "+0000"
    public defaultTimestampFormat: string = "YYYY-MM-DD HH:mm:ss"

    constructor() {}

    /**
     *
     * @return {Date}
     */
    getNow(): Date {
        return moment().utcOffset(this.timeZone).toDate()
    }

    /**
     *
     * @param timestamp дата и время в строковом формате без часового пояса (т.е. не ISO8601)
     * @param format
     * @return {Date}
     */
    parseDate(timestamp: string, format: string = this.defaultTimestampFormat): Date {
        let m = moment(timestamp, format).utcOffset(this.timeZone, true)
        return m.toDate()
    }

    /**
     *
     * @param timestamp дата и время в строковом формате ISO8601 c часовым поясом
     * @return {Date}
     */
    parseDateISO(timestamp: string): Date {
        let m = moment.parseZone(timestamp, ISO_8601)
        if (!m.isValid())
            return null;
        return m.toDate()
    }

    /**
     *
     * @param {Date} date дата и время в UTC формате
     */
    formatDateISO(date: Date): string {
        return moment.utc(date.getTime())
            .utcOffset(this.timeZone, false).toISOString(true)
    }

    /**
     * @param {Date} date дата и время в UTC формате
     * @param {string} format
     */
    formatDate(date: Date, format: string): string {
        return moment.utc(date.getTime()).utcOffset(this.timeZone, false).format(format)
    }

    /**
     * возвращает разницу между датами в секундах
     */
    diff(date1: Date, date2: Date): number {
        const a = moment.utc(date1.getTime()).utcOffset(this.timeZone)
        const b = moment.utc(date2.getTime()).utcOffset(this.timeZone)
        return a.diff(b, 'seconds')
    }

    /**
     * добавляем временной интервал к дате
     * interval интервал в секундах
     * unit e.g. seconds, minutes, hours, days
     */
    addInterval(date, interval: number, unit: string = 'seconds'): Date {
        const mt = moment.utc(date.getTime()).utcOffset(this.timeZone)
        return mt.add(interval as DurationInputArg1, unit as DurationInputArg2).toDate()
    }

    /**
     * вычитаем временной интервал из даты
     * interval интервал в секундах
     * unit e.g. seconds, minutes, hours, days
     */
    subInterval(date: Date, interval: number, unit: string = 'seconds'): Date {
        const mt = moment.utc(date.getTime()).utcOffset(this.timeZone)
        return mt.subtract(interval as DurationInputArg1, unit as DurationInputArg2).toDate()
    }

    getDayOfWeek(date: Date) : number {
        return moment.utc(date.getTime()).utcOffset(this.timeZone).isoWeekday()
    }

    getHour(date: Date) : number {
        return moment.utc(date.getTime()).utcOffset(this.timeZone).hour()
    }

    getMinute(date: Date) : number {
        return moment.utc(date.getTime()).utcOffset(this.timeZone).minute()
    }

}

