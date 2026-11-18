const db = require("../db");

// Search buses by source, destination and travel date
const searchBuses = (req, res) => {
    const { source, destination, date } = req.query;

    // Validate input
    if (!source || !destination || !date) {
        return res.status(400).json({
            status: "error",
            message: "Source, destination and date are required."
        });
    }

    const sql = `
        SELECT
            s.schedule_id,
            b.bus_id,
            b.bus_name,
            b.bus_number,
            b.bus_type,
            r.source_city,
            r.destination_city,
            s.departure_datetime,
            s.arrival_datetime,
            s.fare,
            b.total_seats,
            COUNT(DISTINCT bs.seat_id) AS booked_seats,
            b.total_seats - COUNT(DISTINCT bs.seat_id) AS available_seats

        FROM schedules s

        JOIN buses b ON s.bus_id = b.bus_id
        JOIN routes r ON s.route_id = r.route_id

        LEFT JOIN booking_seats bs
            ON s.schedule_id = bs.schedule_id
            AND bs.seat_status = 'BOOKED'

        WHERE
            r.source_city = ?
            AND r.destination_city = ?
            AND DATE(s.departure_datetime) = ?
            AND s.status = 'SCHEDULED'
            AND b.is_active = TRUE

        GROUP BY
            s.schedule_id,
            b.bus_id,
            b.bus_name,
            b.bus_number,
            b.bus_type,
            r.source_city,
            r.destination_city,
            s.departure_datetime,
            s.arrival_datetime,
            s.fare,
            b.total_seats

        ORDER BY s.departure_datetime;
    `;

    db.query(sql, [source, destination, date], (err, results) => {
        if (err) {
            console.error("Bus search error:", err.message);

            return res.status(500).json({
                status: "error",
                message: "Unable to search buses."
            });
        }

        res.json({
            status: "success",
            count: results.length,
            buses: results
        });
    });
};

module.exports = { searchBuses };