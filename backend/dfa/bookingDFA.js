
const bookingTransitions = {
    START: {
        SELECT_SCHEDULE: "SCHEDULE_SELECTED"
    },
    SCHEDULE_SELECTED: {
        SELECT_SEATS: "SEATS_SELECTED"
    },
    SEATS_SELECTED: {
        VALIDATE_DETAILS: "DETAILS_VALIDATED"
    },
    DETAILS_VALIDATED: {
        CHECK_AVAILABILITY: "AVAILABILITY_CONFIRMED"
    },
    AVAILABILITY_CONFIRMED: {
        CONFIRM_BOOKING: "BOOKING_CONFIRMED"
    }
};

function runBookingDFA(events) {
    let currentState = "START";
    const stateHistory = [currentState];

    for (const event of events) {
        const nextState = bookingTransitions[currentState]?.[event];

        if (!nextState) {
            return {
                accepted: false,
                currentState: "REJECTED",
                stateHistory: [...stateHistory, "REJECTED"]
            };
        }

        currentState = nextState;
        stateHistory.push(currentState);
    }

    return {
        accepted: currentState === "BOOKING_CONFIRMED",
        currentState,
        stateHistory
    };
}

module.exports = { runBookingDFA };
