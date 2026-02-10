from datetime import datetime
from sqlalchemy import (
    Column, Integer, BigInteger, String, Text, DateTime, Date, Float,
    ForeignKey, UniqueConstraint
)
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()


class Series(Base):
    __tablename__ = "series"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    name = Column(String(100), nullable=False)
    slug = Column(String(50), nullable=False, unique=True)
    logo_url = Column(String(500))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    seasons = relationship("Season", back_populates="series")
    events = relationship("Event", back_populates="series")
    teams = relationship("Team", back_populates="series")
    drivers = relationship("Driver", back_populates="series")
    feed_items = relationship("FeedItem", back_populates="series")


class Season(Base):
    __tablename__ = "seasons"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    series_id = Column(BigInteger, ForeignKey("series.id"), nullable=False)
    year = Column(Integer, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    series = relationship("Series", back_populates="seasons")

    __table_args__ = (
        UniqueConstraint("series_id", "year", name="uq_seasons_series_year"),
    )


class Circuit(Base):
    __tablename__ = "circuits"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    name = Column(String(200), nullable=False)
    slug = Column(String(100), nullable=False, unique=True)
    city = Column(String(100))
    country = Column(String(100))
    latitude = Column(Float)
    longitude = Column(Float)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    events = relationship("Event", back_populates="circuit")


class Event(Base):
    __tablename__ = "events"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    series_id = Column(BigInteger, ForeignKey("series.id"), nullable=False)
    circuit_id = Column(BigInteger, ForeignKey("circuits.id"))
    season_id = Column(BigInteger, ForeignKey("seasons.id"))
    name = Column(String(200), nullable=False)
    slug = Column(String(200), nullable=False)
    round_number = Column(Integer)
    start_date = Column(Date)
    end_date = Column(Date)
    status = Column(String(50), default="upcoming")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    series = relationship("Series", back_populates="events")
    circuit = relationship("Circuit", back_populates="events")
    sessions = relationship("Session", back_populates="event")

    __table_args__ = (
        UniqueConstraint("series_id", "slug", name="uq_events_series_slug"),
    )


class Session(Base):
    __tablename__ = "sessions"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    event_id = Column(BigInteger, ForeignKey("events.id"), nullable=False)
    name = Column(String(100), nullable=False)
    slug = Column(String(100), nullable=False)
    session_type = Column(String(50))
    scheduled_start = Column(DateTime)
    scheduled_end = Column(DateTime)
    status = Column(String(50), default="upcoming")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    event = relationship("Event", back_populates="sessions")
    results = relationship("Result", back_populates="session")

    __table_args__ = (
        UniqueConstraint("event_id", "slug", name="uq_sessions_event_slug"),
    )


class Team(Base):
    __tablename__ = "teams"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    series_id = Column(BigInteger, ForeignKey("series.id"), nullable=False)
    name = Column(String(200), nullable=False)
    slug = Column(String(100), nullable=False)
    color = Column(String(7))
    logo_url = Column(String(500))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    series = relationship("Series", back_populates="teams")
    drivers = relationship("Driver", back_populates="team")

    __table_args__ = (
        UniqueConstraint("series_id", "slug", name="uq_teams_series_slug"),
    )


class Driver(Base):
    __tablename__ = "drivers"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    series_id = Column(BigInteger, ForeignKey("series.id"), nullable=False)
    team_id = Column(BigInteger, ForeignKey("teams.id"))
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    slug = Column(String(100), nullable=False)
    number = Column(Integer)
    abbreviation = Column(String(10))
    headshot_url = Column(String(500))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    series = relationship("Series", back_populates="drivers")
    team = relationship("Team", back_populates="drivers")
    results = relationship("Result", back_populates="driver")

    __table_args__ = (
        UniqueConstraint("series_id", "slug", name="uq_drivers_series_slug"),
    )


class Result(Base):
    __tablename__ = "results"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    session_id = Column(BigInteger, ForeignKey("sessions.id"), nullable=False)
    driver_id = Column(BigInteger, ForeignKey("drivers.id"), nullable=False)
    team_id = Column(BigInteger, ForeignKey("teams.id"))
    position = Column(Integer)
    grid_position = Column(Integer)
    points = Column(Float, default=0.0)
    status = Column(String(50))
    fastest_lap = Column(String(20))
    gap_to_leader = Column(String(50))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    session = relationship("Session", back_populates="results")
    driver = relationship("Driver", back_populates="results")

    __table_args__ = (
        UniqueConstraint("session_id", "driver_id", name="uq_results_session_driver"),
    )


class FeedItem(Base):
    __tablename__ = "feed_items"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    series_id = Column(BigInteger, ForeignKey("series.id"), nullable=False)
    item_type = Column(String(50), nullable=False)
    title = Column(String(500), nullable=False)
    summary = Column(Text)
    content = Column(Text)
    image_url = Column(String(500))
    video_url = Column(String(500))
    published_at = Column(DateTime, default=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    series = relationship("Series", back_populates="feed_items")
