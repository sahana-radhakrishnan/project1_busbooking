const db = require("../db");

// LIST BUSES
exports.getBuses = async (req, res) => {
    try {
        const [rows] = await db.promise().query(
            `SELECT bus_id, bus_number, bus_name, bus_type,
                    total_seats, is_active
             FROM buses
             ORDER BY bus_id DESC`
        );

        res.json({ status: "success", buses: rows });
    } catch (error) {
        console.error(error);
        res.status(500).json({ status: "error", message: "Unable to load buses." });
    }
};

// ADD BUS AND GENERATE SEATS
exports.addBus = async (req, res) => {
    const { bus_number, bus_name, bus_type, total_seats } = req.body;
    const seatCount = Number(total_seats);

    if (!bus_number || !bus_name || !bus_type ||
        !Number.isInteger(seatCount) || seatCount < 1 || seatCount > 100) {
        return res.status(400).json({
            status: "error",
            message: "Enter valid bus details. Seat count must be between 1 and 100."
        });
    }

    let connection;

    try {
        connection = await db.promise().getConnection();
        await connection.beginTransaction();

        const [result] = await connection.execute(
            `INSERT INTO buses
             (bus_number, bus_name, bus_type, total_seats, is_active)
             VALUES (?, ?, ?, ?, TRUE)`,
            [bus_number.trim(), bus_name.trim(), bus_type.trim(), seatCount]
        );

        const busId = result.insertId;

        for (let i = 1; i <= seatCount; i++) {
            const seatType = i % 3 === 1
                ? "WINDOW"
                : i % 3 === 2 ? "AISLE" : "MIDDLE";

            await connection.execute(
                `INSERT INTO bus_seats (bus_id, seat_number, seat_type)
                 VALUES (?, ?, ?)`,
                [busId, `S${i}`, seatType]
            );
        }

        await connection.commit();

        res.status(201).json({
            status: "success",
            message: "Bus added and seats generated successfully.",
            bus_id: busId
        });
    } catch (error) {
        if (connection) await connection.rollback();

        console.error(error);
        res.status(500).json({
            status: "error",
            message: error.code === "ER_DUP_ENTRY"
                ? "This bus number already exists."
                : "Unable to add bus."
        });
    } finally {
        if (connection) connection.release();
    }
};

// ACTIVATE / DEACTIVATE BUS
exports.updateBusStatus = async (req, res) => {
    const { active } = req.body;
    const busId = Number(req.params.id);

    if (!Number.isInteger(busId) || ![true, false].includes(active)) {
        return res.status(400).json({ status: "error", message: "Invalid bus status." });
    }

    try {
        const [result] = await db.promise().execute(
            "UPDATE buses SET is_active = ? WHERE bus_id = ?",
            [active, busId]
        );

        if (!result.affectedRows) {
            return res.status(404).json({ status: "error", message: "Bus not found." });
        }

        res.json({ status: "success", message: "Bus status updated." });
    } catch (error) {
        console.error(error);
        res.status(500).json({ status: "error", message: "Unable to update bus." });
    }
};

// LIST ROUTES
exports.getRoutes = async (req, res) => {
    try {
        const [routes] = await db.promise().query(
            "SELECT * FROM routes ORDER BY route_id DESC"
        );
        res.json({ status: "success", routes });
    } catch (error) {
        console.error(error);
        res.status(500).json({ status: "error", message: "Unable to load routes." });
    }
};

// ADD ROUTE
exports.addRoute = async (req, res) => {
    const { source_city, destination_city, distance_km } = req.body;
    const distance = Number(distance_km);

    if (!source_city || !destination_city ||
        source_city.trim().toLowerCase() === destination_city.trim().toLowerCase() ||
        !Number.isFinite(distance) || distance <= 0) {
        return res.status(400).json({
            status: "error",
            message: "Enter two different cities and a valid positive distance."
        });
    }

    try {
        await db.promise().execute(
            `INSERT INTO routes (source_city, destination_city, distance_km)
             VALUES (?, ?, ?)`,
            [source_city.trim(), destination_city.trim(), distance]
        );

        res.status(201).json({ status: "success", message: "Route added successfully." });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            status: "error",
            message: error.code === "ER_DUP_ENTRY"
                ? "This route already exists."
                : "Unable to add route."
        });
    }
};

// LIST SCHEDULES
exports.getSchedules = async (req, res) => {
    try {
        const [schedules] = await db.promise().query(
            `SELECT s.schedule_id, s.bus_id, s.route_id,
                    b.bus_name, b.bus_number,
                    r.source_city, r.destination_city,
                    s.departure_datetime, s.arrival_datetime,
                    s.fare, s.status
             FROM schedules s
             JOIN buses b ON s.bus_id = b.bus_id
             JOIN routes r ON s.route_id = r.route_id
             ORDER BY s.departure_datetime DESC`
        );

        res.json({ status: "success", schedules });
    } catch (error) {
        console.error(error);
        res.status(500).json({ status: "error", message: "Unable to load schedules." });
    }
};

// ADD SCHEDULE
exports.addSchedule = async (req, res) => {
    const {
        bus_id, route_id, departure_datetime,
        arrival_datetime, fare
    } = req.body;

    const busId = Number(bus_id);
    const routeId = Number(route_id);
    const amount = Number(fare);

    if (!Number.isInteger(busId) || !Number.isInteger(routeId) ||
        !departure_datetime || !arrival_datetime ||
        !Number.isFinite(amount) || amount <= 0 ||
        new Date(departure_datetime) >= new Date(arrival_datetime)) {
        return res.status(400).json({
            status: "error",
            message: "Enter valid bus, route, dates and fare."
        });
    }

    try {
        const [buses] = await db.promise().execute(
            "SELECT bus_id FROM buses WHERE bus_id = ? AND is_active = TRUE",
            [busId]
        );

        const [routes] = await db.promise().execute(
            "SELECT route_id FROM routes WHERE route_id = ?",
            [routeId]
        );

        if (!buses.length || !routes.length) {
            return res.status(400).json({
                status: "error",
                message: "Select an existing active bus and valid route."
            });
        }

        await db.promise().execute(
            `INSERT INTO schedules
             (bus_id, route_id, departure_datetime, arrival_datetime, fare, status)
             VALUES (?, ?, ?, ?, ?, 'SCHEDULED')`,
            [busId, routeId, departure_datetime, arrival_datetime, amount]
        );

        res.status(201).json({ status: "success", message: "Schedule created successfully." });
    } catch (error) {
        console.error(error);
        res.status(500).json({ status: "error", message: "Unable to create schedule." });
    }
};

// UPDATE SCHEDULE STATUS
exports.updateScheduleStatus = async (req, res) => {
    const scheduleId = Number(req.params.id);
    const { status } = req.body;
    const allowed = ["SCHEDULED", "CANCELLED", "COMPLETED"];

    if (!Number.isInteger(scheduleId) || !allowed.includes(status)) {
        return res.status(400).json({ status: "error", message: "Invalid schedule status." });
    }

    try {
        const [result] = await db.promise().execute(
            "UPDATE schedules SET status = ? WHERE schedule_id = ?",
            [status, scheduleId]
        );

        if (!result.affectedRows) {
            return res.status(404).json({ status: "error", message: "Schedule not found." });
        }

        res.json({ status: "success", message: "Schedule status updated." });
    } catch (error) {
        console.error(error);
        res.status(500).json({ status: "error", message: "Unable to update schedule." });
    }
};