from datetime import datetime, timezone
from sqlalchemy import (
    Column, BigInteger, String, Text, DateTime, Date, Integer, Numeric,
    ForeignKey, UniqueConstraint
)
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()


class Series(Base):
    __tablename__ = "series"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    name = Column(String(100), nullable=False)
    slug = Column(String(50), nullable=False, unique=True)
    color_primary = Column(String(7), nullable=False)
    color_secondary = Column(String(7), nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    seasons = relationship("Season", back_populates="series")
    teams = relationship("Team", back_populates="series")
    feed_items = relationship("FeedItem", back_populates="series")


class Season(Base):
    __tablename__ = "seasons"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    series_id = Column(BigInteger, ForeignKey("series.id"), nullable=False)
    year = Column(Integer, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    series = relationship("Series", back_populates="seasons")
    events = relationship("Event", back_populates="season")

    __table_args__ = (
        UniqueConstraint("series_id", "year", name="seasons_series_id_year_key"),
    )


class Circuit(Base):
    __tablename__ = "circuits"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    name = Column(String(200), nullable=False)
    country = Column(String(100), nullable=False)
    city = Column(String(100), nullable=False)
    track_map_url = Column(Text)
    timezone = Column(String(50), nullable=False)

    events = relationship("Event", back_populates="circuit")


class Event(Base):
    __tablename__ = "events"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    season_id = Column(BigInteger, ForeignKey("seasons.id"), nullable=False)
    circuit_id = Column(BigInteger, ForeignKey("circuits.id"), nullable=False)
    name = Column(String(200), nullable=False)
    slug = Column(String(100), nullable=False, unique=True)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    status = Column(String(20), nullable=False, default="upcoming")
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    season = relationship("Season", back_populates="events")
    circuit = relationship("Circuit", back_populates="events")
    sessions = relationship("Session", back_populates="event")
    feed_items = relationship("FeedItem", back_populates="event")


class Session(Base):
    __tablename__ = "sessions"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    event_id = Column(BigInteger, ForeignKey("events.id"), nullable=False)
    type = Column(String(30), nullable=False)
    name = Column(String(100), nullable=False)
    start_time = Column(DateTime, nullable=False)
    end_time = Column(DateTime)
    status = Column(String(20), nullable=False, default="scheduled")

    event = relationship("Event", back_populates="sessions")
    results = relationship("Result", back_populates="session")


class Team(Base):
    __tablename__ = "teams"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    series_id = Column(BigInteger, ForeignKey("series.id"), nullable=False)
    name = Column(String(200), nullable=False)
    short_name = Column(String(50), nullable=False)
    color = Column(String(7), nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    series = relationship("Series", back_populates="teams")
    drivers = relationship("Driver", back_populates="team")


class Driver(Base):
    __tablename__ = "drivers"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    name = Column(String(200), nullable=False)
    number = Column(Integer)
    team_id = Column(BigInteger, ForeignKey("teams.id"))
    nationality = Column(String(100))
    slug = Column(String(100), nullable=False, unique=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    team = relationship("Team", back_populates="drivers")
    results = relationship("Result", back_populates="driver")


class Result(Base):
    __tablename__ = "results"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    session_id = Column(BigInteger, ForeignKey("sessions.id"), nullable=False)
    driver_id = Column(BigInteger, ForeignKey("drivers.id"), nullable=False)
    position = Column(Integer, nullable=False)
    time = Column(String(50))
    laps = Column(Integer)
    gap = Column(String(50))
    status = Column(String(50), nullable=False, default="finished")
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    session = relationship("Session", back_populates="results")
    driver = relationship("Driver", back_populates="results")

    __table_args__ = (
        UniqueConstraint("session_id", "driver_id", name="uq_results_session_driver"),
    )


class DriverStanding(Base):
    __tablename__ = "driver_standings"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    season_id = Column(BigInteger, ForeignKey("seasons.id"), nullable=False)
    driver_id = Column(BigInteger, ForeignKey("drivers.id"), nullable=False)
    position = Column(Integer, nullable=False)
    points = Column(Numeric(8, 2), nullable=False, default=0)
    wins = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    season = relationship("Season")
    driver = relationship("Driver")

    __table_args__ = (
        UniqueConstraint("season_id", "driver_id", name="driver_standings_season_id_driver_id_key"),
    )


class ConstructorStanding(Base):
    __tablename__ = "constructor_standings"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    season_id = Column(BigInteger, ForeignKey("seasons.id"), nullable=False)
    team_id = Column(BigInteger, ForeignKey("teams.id"), nullable=False)
    position = Column(Integer, nullable=False)
    points = Column(Numeric(8, 2), nullable=False, default=0)
    wins = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    season = relationship("Season")
    team = relationship("Team")

    __table_args__ = (
        UniqueConstraint("season_id", "team_id", name="constructor_standings_season_id_team_id_key"),
    )


class FeedItem(Base):
    __tablename__ = "feed_items"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    type = Column(String(30), nullable=False)
    series_id = Column(BigInteger, ForeignKey("series.id"))
    event_id = Column(BigInteger, ForeignKey("events.id"))
    title = Column(String(500), nullable=False)
    summary = Column(Text, nullable=False)
    content_url = Column(Text)
    thumbnail_url = Column(Text)
    published_at = Column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    series = relationship("Series", back_populates="feed_items")
    event = relationship("Event", back_populates="feed_items")
