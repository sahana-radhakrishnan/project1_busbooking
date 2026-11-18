
const db = require("../db");
const crypto = require("crypto");
const { runBookingDFA } = require("../dfa/bookingDFA");

const createBooking = async (req, res) => {
    const { schedule_id, seat_ids } = req.body;
    const user_id = req.user.user_id;

    if (
        !Number.isInteger(Number(schedule_id)) ||
        !Array.isArray(seat_ids) ||
        seat_ids.length === 0 ||
        !seat_ids.every(id => Number.isInteger(Number(id)) && Number(id) > 0)
    ) {
        return res.status(400).json({
            status: "error",
            message: "Valid schedule ID and seat IDs are required."
        });
    }

    const selectedSeats = [...new Set(seat_ids.map(Number))];

    if (selectedSeats.length !== seat_ids.length) {
        return res.status(400).json({
            status: "error",
            message: "Duplicate seat IDs are not allowed."
        });
    }

    const dfaEvents = [];
    let connection;

    try {
        connection = await db.promise().getConnection();
        await connection.beginTransaction();

        // Stage 1: Select and validate schedule.
        const [schedules] = await connection.execute(
            `SELECT schedule_id, bus_id, fare
             FROM schedules
             WHERE schedule_id = ? AND status = 'SCHEDULED'
             FOR UPDATE`,
            [Number(schedule_id)]
        );

        if (schedules.length === 0) {
            await connection.rollback();
            return res.status(404).json({
                status: "error",
                message: "Schedule not found or unavailable."
            });
        }

        dfaEvents.push("SELECT_SCHEDULE");

        const schedule = schedules[0];

        // Stage 2: Validate selected seats.
        const placeholders = selectedSeats.map(() => "?").join(",");

        const [validSeats] = await connection.execute(
            `SELECT seat_id
             FROM bus_seats
             WHERE bus_id = ?
             AND seat_id IN (${placeholders})
             FOR UPDATE`,
            [schedule.bus_id, ...selectedSeats]
        );

        if (validSeats.length !== selectedSeats.length) {
            await connection.rollback();
            return res.status(400).json({
                status: "error",
                message: "One or more selected seats are invalid."
            });
        }

        dfaEvents.push("SELECT_SEATS");
        dfaEvents.push("VALIDATE_DETAILS");

        // Stage 3: Check seat availability.
        const [bookedSeats] = await connection.execute(
            `SELECT seat_id
             FROM booking_seats
             WHERE schedule_id = ?
             AND seat_status = 'BOOKED'
             AND seat_id IN (${placeholders})`,
            [Number(schedule_id), ...selectedSeats]
        );

        if (bookedSeats.length > 0) {
            await connection.rollback();
            return res.status(409).json({
                status: "error",
                message: "One or more selected seats are already booked.",
                booked_seats: bookedSeats.map(seat => seat.seat_id)
            });
        }

        dfaEvents.push("CHECK_AVAILABILITY");

        const totalAmount = Number(schedule.fare) * selectedSeats.length;

        const bookingReference =
            "TRQ" + Date.now() +
            crypto.randomBytes(3).toString("hex").toUpperCase();

        // Stage 4: Create booking.
        const [bookingResult] = await connection.execute(
            `INSERT INTO bookings
             (booking_reference, user_id, schedule_id, total_amount,
              booking_status, payment_status)
             VALUES (?, ?, ?, ?, 'CONFIRMED', 'NOT_REQUIRED')`,
            [
                bookingReference,
                user_id,
                Number(schedule_id),
                totalAmount
            ]
        );

        const bookingId = bookingResult.insertId;

        // Save selected seats.
        const seatValues = selectedSeats
            .map(() => "(?, ?, ?, 'BOOKED')")
            .join(",");

        const seatParams = [];

        selectedSeats.forEach(seatId => {
            seatParams.push(
                bookingId,
                Number(schedule_id),
                seatId
            );
        });

        await connection.execute(
            `INSERT INTO booking_seats
             (booking_id, schedule_id, seat_id, seat_status)
             VALUES ${seatValues}`,
            seatParams
        );

        await connection.commit();

        // Final DFA transition after successful booking.
        dfaEvents.push("CONFIRM_BOOKING");

        const dfaResult = runBookingDFA(dfaEvents);

        return res.status(201).json({
            status: "success",
            message: "Booking confirmed successfully!",
            booking: {
                booking_id: bookingId,
                booking_reference: bookingReference,
                schedule_id: Number(schedule_id),
                seat_ids: selectedSeats,
                number_of_seats: selectedSeats.length,
                fare_per_seat: Number(schedule.fare),
                total_amount: totalAmount,
                booking_status: "CONFIRMED"
            },
            dfa: dfaResult
        });

    } catch (error) {
        if (connection) {
            await connection.rollback();
        }

        console.error("Booking error:", error.message);

        if (error.code === "ER_DUP_ENTRY") {
            return res.status(409).json({
                status: "error",
                message: "One or more selected seats have already been booked."
            });
        }

        return res.status(500).json({
            status: "error",
            message: "Unable to complete booking."
        });

    } finally {
        if (connection) {
            connection.release();
        }
    }
};

module.exports = { createBooking };
