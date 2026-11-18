
const db = require("../db");
const { runCancellationDFA } = require("../dfa/cancellationDFA");

const cancelBooking = async (req, res) => {
    const booking_id = Number(req.params.booking_id);
    const user_id = req.user.user_id;
    const { seat_ids, reason } = req.body;

    if (
        !Number.isInteger(booking_id) ||
        booking_id <= 0 ||
        !Array.isArray(seat_ids) ||
        seat_ids.length === 0 ||
        !seat_ids.every(id => Number.isInteger(Number(id)) && Number(id) > 0)
    ) {
        return res.status(400).json({
            status: "error",
            message: "Valid booking ID and seat IDs are required."
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

        // Stage 1: Identify the passenger's booking.
        const [bookings] = await connection.execute(
            `SELECT booking_id, booking_status
             FROM bookings
             WHERE booking_id = ? AND user_id = ?
             FOR UPDATE`,
            [booking_id, user_id]
        );

        if (bookings.length === 0) {
            await connection.rollback();
            return res.status(404).json({
                status: "error",
                message: "Booking not found."
            });
        }

        dfaEvents.push("IDENTIFY_BOOKING");

        const booking = bookings[0];

        if (booking.booking_status === "CANCELLED") {
            await connection.rollback();
            return res.status(400).json({
                status: "error",
                message: "This booking is already cancelled."
            });
        }

        // Stage 2: Receive cancellation request.
        dfaEvents.push("REQUEST_CANCELLATION");

        const placeholders = selectedSeats.map(() => "?").join(",");

        // Stage 3: Validate seats in the booking.
        const [bookingSeats] = await connection.execute(
            `SELECT booking_seat_id, seat_id
             FROM booking_seats
             WHERE booking_id = ?
             AND seat_status = 'BOOKED'
             AND seat_id IN (${placeholders})
             FOR UPDATE`,
            [booking_id, ...selectedSeats]
        );

        if (bookingSeats.length !== selectedSeats.length) {
            await connection.rollback();
            return res.status(400).json({
                status: "error",
                message: "One or more seats are invalid or already cancelled."
            });
        }

        dfaEvents.push("VALIDATE_CANCELLATION");

        const cancellationReason =
            typeof reason === "string" && reason.trim()
                ? reason.trim().slice(0, 255)
                : "Passenger requested cancellation";

        // Stage 4: Record each cancellation.
        for (const seat of bookingSeats) {
            await connection.execute(
                `INSERT INTO cancellations
                 (booking_id, booking_seat_id, cancellation_date,
                  reason, refund_amount)
                 VALUES (?, ?, NOW(), ?, 0)`,
                [
                    booking_id,
                    seat.booking_seat_id,
                    cancellationReason
                ]
            );
        }

        // Update cancelled seats.
        await connection.execute(
            `UPDATE booking_seats
             SET seat_status = 'CANCELLED'
             WHERE booking_id = ?
             AND seat_id IN (${placeholders})
             AND seat_status = 'BOOKED'`,
            [booking_id, ...selectedSeats]
        );

        // Check remaining active seats.
        const [remainingSeats] = await connection.execute(
            `SELECT COUNT(*) AS active_seats
             FROM booking_seats
             WHERE booking_id = ?
             AND seat_status = 'BOOKED'`,
            [booking_id]
        );

        const newStatus =
            Number(remainingSeats[0].active_seats) === 0
                ? "CANCELLED"
                : "PARTIALLY_CANCELLED";

        await connection.execute(
            `UPDATE bookings
             SET booking_status = ?
             WHERE booking_id = ?`,
            [newStatus, booking_id]
        );

        await connection.commit();

        // Final DFA transition after successful database commit.
        dfaEvents.push("CONFIRM_CANCELLATION");

        const dfaResult = runCancellationDFA(dfaEvents);

        return res.json({
            status: "success",
            message: "Seat cancellation completed successfully!",
            cancellation: {
                booking_id,
                cancelled_seat_ids: selectedSeats,
                cancelled_count: selectedSeats.length,
                booking_status: newStatus,
                refund_amount: 0
            },
            dfa: dfaResult
        });

    } catch (error) {
        if (connection) {
            await connection.rollback();
        }

        console.error("Cancellation error:", error.message);

        return res.status(500).json({
            status: "error",
            message: "Unable to cancel booking."
        });

    } finally {
        if (connection) {
            connection.release();
        }
    }
};

module.exports = { cancelBooking };
