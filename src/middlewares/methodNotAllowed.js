/**
 * 405 METHOD NOT ALLOWED
 * ----------------------
 *   404 = alamatnya tidak ada.
 *   405 = alamatnya ADA, tapi method yang dipakai tidak didukung di situ.
 *
 * RFC 9110 mewajibkan response 405 menyertakan header "Allow" berisi method
 * yang boleh. Dipasang lewat `.all(methodNotAllowed(...))` pada tiap route,
 * supaya method liar di jalur yang ada tidak jatuh ke notFound (404).
 *
 * @param {...string} allowed  daftar method yang diizinkan pada route itu
 */
const methodNotAllowed = (...allowed) => {
  return (req, res) => {
    return res
      .set("Allow", allowed.join(", "))
      .status(405)
      .json({
        status: "fail",
        message: `Method ${req.method} tidak diizinkan untuk endpoint ini`,
        allowed,
      });
  };
};

module.exports = methodNotAllowed;
