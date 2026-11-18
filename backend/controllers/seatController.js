const db = require("../db");

// Get seat availability for a schedule
const getSeatAvailability = (req, res) => {
    const { schedule_id } = req.params;

    if (!schedule_id || isNaN(Number(schedule_id))) {
        return res.status(400).json({
            status: "error",
            message: "Valid schedule ID is required."
        });
    }

    const sql = `
        SELECT
            s.seat_id,
            s.seat_number,
            s.seat_type,
            CASE
                WHEN bs.booking_seat_id IS NULL THEN 'AVAILABLE'
                ELSE 'BOOKED'
            END AS seat_status
        FROM schedules sch
        JOIN bus_seats s
            ON sch.bus_id = s.bus_id
        LEFT JOIN booking_seats bs
            ON bs.seat_id = s.seat_id
            AND bs.schedule_id = sch.schedule_id
            AND bs.seat_status = 'BOOKED'
        WHERE sch.schedule_id = ?
        ORDER BY s.seat_id;
    `;

    db.query(sql, [schedule_id], (err, results) => {
        if (err) {
            console.error(err.message);

            return res.status(500).json({
                status: "error",
                message: "Unable to retrieve seat availability."
            });
        }

        if (results.length === 0) {
            return res.status(404).json({
                status: "error",
                message: "Schedule not found."
            });
        }

        res.json({
            status: "success",
            schedule_id: Number(schedule_id),
            total_seats: results.length,
            available_seats: results.filter(
                seat => seat.seat_status === "AVAILABLE"
            ).length,
            booked_seats: results.filter(
                seat => seat.seat_status === "BOOKED"
            ).length,
            seats: results
        });
    });
};

module.exports = { getSeatAvailability };