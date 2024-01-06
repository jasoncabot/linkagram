export const keyForToday = () => {
    return keyForDate(new Date());
};

export const keyForDate = (date: Date) => {
    const today = new Date();
    const paddedDayString = today.getDate().toString().padStart(2, '0');
    const paddedMonthString = (today.getMonth() + 1).toString().padStart(2, '0');
    return today.getFullYear() + paddedMonthString + paddedDayString;
}
