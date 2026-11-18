
USE transitiq;

-- 1. Total bookings
SELECT
    COUNT(*) AS total_bookings
FROM bookings;


-- 2. Total revenue from currently active booked seats
SELECT
    COALESCE(SUM(s.fare), 0) AS total_revenue
FROM booking_seats bs
JOIN schedules s ON bs.schedule_id = s.schedule_id
WHERE bs.seat_status = 'BOOKED';


-- 3. Total seats currently booked
SELECT
    COUNT(*) AS booked_seats
FROM booking_seats
WHERE seat_status = 'BOOKED';


-- 4. Overall seat occupancy percentage
SELECT
    ROUND(
        (
            SELECT COUNT(*)
            FROM booking_seats bs
            JOIN schedules s ON bs.schedule_id = s.schedule_id
            WHERE bs.seat_status = 'BOOKED'
              AND s.status = 'SCHEDULED'
        )
        /
        NULLIF(
            (
                SELECT SUM(b.total_seats)
                FROM schedules s
                JOIN buses b ON s.bus_id = b.bus_id
                WHERE s.status = 'SCHEDULED'
            ),
            0
        ) * 100,
        2
    ) AS occupancy_percentage;

-- 5. Cancellation rate
SELECT
    ROUND(
        COUNT(CASE WHEN seat_status = 'CANCELLED' THEN 1 END)
        / NULLIF(COUNT(*), 0) * 100,
        2
    ) AS cancellation_rate
FROM booking_seats;


-- 6. Most popular routes
SELECT
    r.source_city,
    r.destination_city,
    COUNT(DISTINCT b.booking_id) AS total_bookings
FROM bookings b
JOIN schedules s ON b.schedule_id = s.schedule_id
JOIN routes r ON s.route_id = r.route_id
GROUP BY r.route_id, r.source_city, r.destination_city
ORDER BY total_bookings DESC;


-- 7. Daily booking trend
SELECT
    DATE(booking_date) AS booking_day,
    COUNT(*) AS total_bookings
FROM bookings
GROUP BY DATE(booking_date)
ORDER BY booking_day;


-- 8. Booking status distribution
SELECT
    booking_status,
    COUNT(*) AS total
FROM bookings
GROUP BY booking_status;


-- 9. Bus-wise seat occupancy
SELECT
    b.bus_name,
    b.bus_number,
    s.schedule_id,
    b.total_seats,
    COUNT(bs.booking_seat_id) AS booked_seats,
    ROUND(
        COUNT(bs.booking_seat_id) / NULLIF(b.total_seats, 0) * 100,
        2
    ) AS occupancy_percentage
FROM buses b
JOIN schedules s ON b.bus_id = s.bus_id
LEFT JOIN booking_seats bs
    ON s.schedule_id = bs.schedule_id
    AND bs.seat_status = 'BOOKED'
GROUP BY
    b.bus_id,
    b.bus_name,
    b.bus_number,
    s.schedule_id,
    b.total_seats
ORDER BY occupancy_percentage DESC;
