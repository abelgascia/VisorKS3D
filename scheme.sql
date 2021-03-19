-- phpMyAdmin SQL Dump
-- version 5.0.2
-- https://www.phpmyadmin.net/
--
-- Servidor: 127.0.0.1
-- Tiempo de generación: 09-07-2020 a las 04:00:36
-- Versión del servidor: 10.4.11-MariaDB
-- Versión de PHP: 7.4.6

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Base de datos: `ks_visor`
--
CREATE DATABASE IF NOT EXISTS `ks_visor` DEFAULT CHARACTER SET latin1 COLLATE latin1_swedish_ci;
USE `ks_visor`;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `cases`
--

CREATE TABLE `cases` (
  `id` int(11) NOT NULL,
  `uid` char(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `status` enum('PROCESSING','READY','ERRORED','WAITING','REMOVED') NOT NULL,
  `created` datetime NOT NULL,
  `result` text NOT NULL,
  `csv_content` text CHARACTER SET utf8 COLLATE utf8_bin DEFAULT NULL,
  `name` text NOT NULL,
  `stage` text NOT NULL,
  `maxilars` text NOT NULL DEFAULT '',
  `user_id` int(11) NOT NULL,
  `case_id` varchar(16) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `cases_input_files`
--

CREATE TABLE `cases_input_files` (
  `case_id` int(11) NOT NULL,
  `input_file_id` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `cases_output_files`
--

CREATE TABLE `cases_output_files` (
  `case_id` int(11) NOT NULL,
  `output_file_uid` char(36) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `input_files`
--

CREATE TABLE `input_files` (
  `id` int(11) NOT NULL,
  `name` varchar(256) NOT NULL,
  `md5` char(32) NOT NULL,
  `size` int(11) NOT NULL,
  `uploaded` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `output_files`
--

CREATE TABLE `output_files` (
  `uid` char(36) NOT NULL,
  `url` text NOT NULL,
  `size` int(11) NOT NULL,
  `uploaded` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

--
-- Índices para tablas volcadas
--

--
-- Indices de la tabla `cases`
--
ALTER TABLE `cases`
  ADD PRIMARY KEY (`id`);

--
-- Indices de la tabla `cases_input_files`
--
ALTER TABLE `cases_input_files`
  ADD UNIQUE KEY `case_id` (`case_id`,`input_file_id`);

--
-- Indices de la tabla `cases_output_files`
--
ALTER TABLE `cases_output_files`
  ADD UNIQUE KEY `case_id` (`case_id`,`output_file_uid`);

--
-- Indices de la tabla `input_files`
--
ALTER TABLE `input_files`
  ADD PRIMARY KEY (`id`),
  ADD KEY `md5` (`md5`);

--
-- Indices de la tabla `output_files`
--
ALTER TABLE `output_files`
  ADD UNIQUE KEY `uid` (`uid`);

--
-- AUTO_INCREMENT de las tablas volcadas
--

--
-- AUTO_INCREMENT de la tabla `cases`
--
ALTER TABLE `cases`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `input_files`
--
ALTER TABLE `input_files`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
