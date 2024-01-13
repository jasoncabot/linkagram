export const keyForToday = () => {
    return keyForDate(new Date());
};

export const keyForDate = (date: Date) => {
    const paddedDayString = date.getDate().toString().padStart(2, '0');
    const paddedMonthString = (date.getMonth() + 1).toString().padStart(2, '0');
    return date.getFullYear() + paddedMonthString + paddedDayString;
}
