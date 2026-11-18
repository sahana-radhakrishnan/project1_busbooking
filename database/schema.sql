
USE transitiq;

-- 1. USERS TABLE
CREATE TABLE users (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    phone VARCHAR(15),
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('PASSENGER', 'ADMIN') DEFAULT 'PASSENGER',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. ROUTES TABLE
CREATE TABLE routes (
    route_id INT AUTO_INCREMENT PRIMARY KEY,
    source_city VARCHAR(100) NOT NULL,
    destination_city VARCHAR(100) NOT NULL,
    distance_km DECIMAL(8,2),
    UNIQUE (source_city, destination_city)
);

-- 3. BUSES TABLE
CREATE TABLE buses (
    bus_id INT AUTO_INCREMENT PRIMARY KEY,
    bus_number VARCHAR(30) NOT NULL UNIQUE,
    bus_name VARCHAR(100),
    bus_type VARCHAR(50),
    total_seats INT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE
);

-- 4. BUS SEATS TABLE
CREATE TABLE bus_seats (
    seat_id INT AUTO_INCREMENT PRIMARY KEY,
    bus_id INT NOT NULL,
    seat_number VARCHAR(10) NOT NULL,
    seat_type ENUM('WINDOW', 'AISLE', 'MIDDLE'),
    FOREIGN KEY (bus_id) REFERENCES buses(bus_id),
    UNIQUE (bus_id, seat_number)
);

-- 5. SCHEDULES TABLE
CREATE TABLE schedules (
    schedule_id INT AUTO_INCREMENT PRIMARY KEY,
    bus_id INT NOT NULL,
    route_id INT NOT NULL,
    departure_datetime DATETIME NOT NULL,
    arrival_datetime DATETIME NOT NULL,
    fare DECIMAL(10,2) NOT NULL,
    status ENUM('SCHEDULED', 'CANCELLED', 'COMPLETED')
        DEFAULT 'SCHEDULED',
    FOREIGN KEY (bus_id) REFERENCES buses(bus_id),
    FOREIGN KEY (route_id) REFERENCES routes(route_id)
);

-- 6. BOOKINGS TABLE
CREATE TABLE bookings (
    booking_id INT AUTO_INCREMENT PRIMARY KEY,
    booking_reference VARCHAR(30) NOT NULL UNIQUE,
    user_id INT NOT NULL,
    schedule_id INT NOT NULL,
    booking_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    total_amount DECIMAL(10,2) NOT NULL,
    booking_status ENUM(
        'CONFIRMED',
        'PARTIALLY_CANCELLED',
        'CANCELLED'
    ) DEFAULT 'CONFIRMED',
    payment_status ENUM(
        'PENDING',
        'PAID',
        'REFUNDED',
        'NOT_REQUIRED'
    ) DEFAULT 'NOT_REQUIRED',
    FOREIGN KEY (user_id) REFERENCES users(user_id),
    FOREIGN KEY (schedule_id) REFERENCES schedules(schedule_id)
);

-- 7. BOOKING SEATS TABLE
CREATE TABLE booking_seats (
    booking_seat_id INT AUTO_INCREMENT PRIMARY KEY,
    booking_id INT NOT NULL,
    schedule_id INT NOT NULL,
    seat_id INT NOT NULL,
    seat_status ENUM('BOOKED', 'CANCELLED') DEFAULT 'BOOKED',

    active_schedule_id INT
        GENERATED ALWAYS AS (
            CASE
                WHEN seat_status = 'BOOKED'
                THEN schedule_id
                ELSE NULL
            END
        ) STORED,

    FOREIGN KEY (booking_id) REFERENCES bookings(booking_id),
    FOREIGN KEY (schedule_id) REFERENCES schedules(schedule_id),
    FOREIGN KEY (seat_id) REFERENCES bus_seats(seat_id),

    UNIQUE (active_schedule_id, seat_id),
    UNIQUE (booking_id, seat_id)
);

-- 8. CANCELLATIONS TABLE
CREATE TABLE cancellations (
    cancellation_id INT AUTO_INCREMENT PRIMARY KEY,
    booking_id INT NOT NULL,
    booking_seat_id INT NOT NULL UNIQUE,
    cancellation_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    reason VARCHAR(255),
    refund_amount DECIMAL(10,2) DEFAULT 0.00,

    FOREIGN KEY (booking_id) REFERENCES bookings(booking_id),
    FOREIGN KEY (booking_seat_id)
        REFERENCES booking_seats(booking_seat_id)
);
