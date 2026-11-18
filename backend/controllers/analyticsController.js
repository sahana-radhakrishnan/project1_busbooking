
const db = require("../db");

async function getDashboardAnalytics(req, res) {
    try {
        const [
            [bookingStats],
            [revenueStats],
            [seatStats],
            [routeStats],
            [dailyStats],
            [statusStats],
            [occupancyStats]
        ] = await Promise.all([
            db.promise().query(`
                SELECT COUNT(*) AS total_bookings
                FROM bookings
            `),

            db.promise().query(`
                SELECT COALESCE(SUM(s.fare), 0) AS total_revenue
                FROM booking_seats bs
                JOIN schedules s ON bs.schedule_id = s.schedule_id
                WHERE bs.seat_status = 'BOOKED'
            `),

            db.promise().query(`
                SELECT
                    COUNT(*) AS total_seats,
                    SUM(seat_status = 'BOOKED') AS booked_seats,
                    SUM(seat_status = 'CANCELLED') AS cancelled_seats
                FROM booking_seats
            `),

            db.promise().query(`
                SELECT
                    r.source_city,
                    r.destination_city,
                    COUNT(DISTINCT b.booking_id) AS total_bookings
                FROM bookings b
                JOIN schedules s ON b.schedule_id = s.schedule_id
                JOIN routes r ON s.route_id = r.route_id
                GROUP BY r.route_id, r.source_city, r.destination_city
                ORDER BY total_bookings DESC
            `),

            db.promise().query(`
                SELECT
                    DATE(booking_date) AS booking_day,
                    COUNT(*) AS total_bookings
                FROM bookings
                GROUP BY DATE(booking_date)
                ORDER BY booking_day
            `),

            db.promise().query(`
                SELECT booking_status, COUNT(*) AS total
                FROM bookings
                GROUP BY booking_status
            `),

            db.promise().query(`
                SELECT
                    b.bus_name,
                    b.bus_number,
                    s.schedule_id,
                    b.total_seats,
                    COUNT(bs.booking_seat_id) AS booked_seats,
                    ROUND(
                        COUNT(bs.booking_seat_id) /
                        NULLIF(b.total_seats, 0) * 100,
                        2
                    ) AS occupancy_percentage
                FROM buses b
                JOIN schedules s ON b.bus_id = s.bus_id
                LEFT JOIN booking_seats bs
                    ON s.schedule_id = bs.schedule_id
                    AND bs.seat_status = 'BOOKED'
                GROUP BY
                    b.bus_id, b.bus_name, b.bus_number,
                    s.schedule_id, b.total_seats
                ORDER BY occupancy_percentage DESC
            `)
        ]);

        const totalSeats = Number(seatStats[0].total_seats || 0);
        const cancelledSeats = Number(seatStats[0].cancelled_seats || 0);

        const cancellationRate = totalSeats > 0
            ? Number((cancelledSeats / totalSeats * 100).toFixed(2))
            : 0;

        res.json({
            status: "success",
            summary: {
                total_bookings: Number(bookingStats[0].total_bookings),
                total_revenue: Number(revenueStats[0].total_revenue),
                booked_seats: Number(seatStats[0].booked_seats || 0),
                cancellation_rate: cancellationRate
            },
            routes: routeStats,
            daily_bookings: dailyStats,
            booking_status: statusStats,
            bus_occupancy: occupancyStats
        });

    } catch (error) {
        console.error("Analytics error:", error.message);

        res.status(500).json({
            status: "error",
            message: "Unable to load analytics data"
        });
    }
}

module.exports = { getDashboardAnalytics };
